const { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const ULID = require('ulid');

const dynamoClient = new DynamoDBClient({});
const sesClient = new SESv2Client({});

const SUPER_ADMIN_SUFFIX = 'CognitoSignIn:958a0a61-7f30-43e0-8007-075d5646ca12';

exports.getLedger = async (event) => {
  try {
    const cmd = new QueryCommand({
      TableName: process.env.STORAGE_LOANS_NAME,
      ScanIndexForward: false,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: marshall({
        ':pk': 'ledger'
      })
    });
  
    const { Items } = await dynamoClient.send(cmd);
    const records = Items.map((x) => unmarshall(x));
  
    const gifts = records.filter((x) => x.type === 'gift').map((x) => ({
      redeemed: x.redeemed,
      createTime: x.createTime,
      redemptionTime: x.redemptionTime,
      id: x.sk,
      value: x.value
    }));
  
    const loans = records.filter((x) => x.type === 'loan').map((x) => ({
      createTime: x.createTime,
      paidOff: x.paidOff,
      paidOffTime: x.paidOffTime,
      id: x.sk,
      value: x.value
    }));
  
    const stats = {
      gifted: gifts.reduce((a, b) => a + b.value, 0),
      redeemable: gifts.filter((x) => !x.redeemed).reduce((a, b) => a + b.value, 0),
      lent: loans.reduce((a, b) => a + b.value, 0),
      debt: loans.filter((x) => !x.paidOff).reduce((a, b) => a + b.value, 0)
    };
  
    return exports.buildResponse(200, { stats, gifts, loans });
  } catch (err) {
    console.error(err.message);
    return exports.buildResponse(500, 'Unexpected error');
  }
}

exports.addGift = async (event) => {
  if (!isSuperAdmin(event)) {
    return exports.buildResponse(401, {
      message: 'Unauthorized'
    });
  }

  try {
    const { value } = JSON.parse(event.body);

    if (typeof value !== 'number') {
      return exports.buildResponse(400, 'Invalid value provided');
    }

    const cmd = new PutItemCommand({
      TableName: process.env.STORAGE_LOANS_NAME,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      Item: marshall({
        pk: 'ledger',
        sk: ULID.ulid(),
        redeemed: false,
        createTime: new Date().toISOString(),
        type: 'gift',
        value: value
      })
    });
  
    await dynamoClient.send(cmd);

    await sendEmail('AddGift', value, 'katygrabfelder@gmail.com');

    return exports.buildResponse(201, 'Gift added successfully');
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return exports.buildResponse(400, 'Gift already exists');
    }

    console.error(err.message);
    return exports.buildResponse(500, 'Unexpected error');
  }
};

exports.redeemGift = async (event) => {
  try {
    const { id } = event.pathParameters;

    if (!id) {
      return exports.buildResponse(400, 'Invalid id provided');
    }

    const updateCmd = new UpdateItemCommand({
      TableName: process.env.STORAGE_LOANS_NAME,
      Key: marshall({
        pk: 'ledger',
        sk: `${id}`
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND #redeemed = :false AND #type = :gift',
      UpdateExpression: 'SET #redeemed = :redeemed, #redemptionTime = :redemptionTime',
      ExpressionAttributeNames: {
        '#redeemed': 'redeemed',
        '#redemptionTime': 'redemptionTime',
        '#type': 'type'
      },
      ExpressionAttributeValues: marshall({
        ':redeemed': true,
        ':redemptionTime': new Date().toISOString(),
        ':false': false,
        ':gift': 'gift'
      }),
      ReturnValues: 'ALL_NEW'
    });

    const { Attributes } = await dynamoClient.send(updateCmd);

    await sendEmail('RedeemGift', Attributes.value.N, 'kylegrabfelder@gmail.com');

    return exports.buildResponse(204, 'Gift redeemed successfully');
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return exports.buildResponse(400, 'The specified gift cannot be redeemed');
    }

    console.error(err.message);
    return exports.buildResponse(500, 'Unexpected error');
  }
};

exports.requestLoan = async (event) => {
  try {
    const { value } = JSON.parse(event.body);

    if (typeof value !== 'number') {
      return exports.buildResponse(400, 'Invalid value provided');
    }

    const cmd = new PutItemCommand({
      TableName: process.env.STORAGE_LOANS_NAME,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      Item: marshall({
        pk: 'ledger',
        sk: ULID.ulid(),
        createTime: new Date().toISOString(),
        paidOff: false,
        type: 'loan',
        value: value
      })
    });

    await dynamoClient.send(cmd);

    await sendEmail('RequestLoan', value, 'kylegrabfelder@gmail.com');

    return exports.buildResponse(204, 'Loan requested');
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return exports.buildResponse(400, 'Loan already exists');
    }

    console.error(err.message);
    return exports.buildResponse(500, 'Unexpected error');
  }
};

exports.payOffLoan = async (event) => {
  try {
    const { id } = event.pathParameters;

    if (!id) {
      return exports.buildResponse(400, 'Invalid id provided');
    }

    const updateCmd = new UpdateItemCommand({
      TableName: process.env.STORAGE_LOANS_NAME,
      Key: marshall({
        pk: 'ledger',
        sk: `${id}`
      }),
      ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND #paidOff = :false AND #type = :loan',
      UpdateExpression: 'SET #paidOff = :true, #paidOffTime = :paidOffTime',
      ExpressionAttributeNames: {
        '#paidOff': 'paidOff',
        '#paidOffTime': 'paidOffTime',
        '#type': 'type'
      },
      ExpressionAttributeValues: marshall({
        ':paidOffTime': new Date().toISOString(),
        ':false': false,
        ':true': true,
        ':loan': 'loan'
      })
    });

    await dynamoClient.send(updateCmd);

    return exports.buildResponse(204, 'Loan paid off successfully');
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return exports.buildResponse(400, 'The specified loan cannot be paid off');
    }

    console.error(err.message);
    return exports.buildResponse(500, 'Unexpected error');
  }
}

exports.buildResponse = (statusCode, body) => {
  if (typeof body === 'string') {
    body = {
      message: body
    }
  }

  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify(body),
};
}

function isSuperAdmin(event) {
  return event.requestContext.identity.cognitoAuthenticationProvider.endsWith(SUPER_ADMIN_SUFFIX);
}

async function sendEmail(templateName, value, toAddress) {
  const cmd = new SendEmailCommand({
    Content: {
      Template: {
        TemplateName: templateName,
        TemplateData: JSON.stringify({ value })
      }
    },
    Destination: {
      ToAddresses: [
        toAddress
      ]
    },
    FromEmailAddress: 'Hey Homie! <hey-homie@kg-dev.net>'
  });

  await sesClient.send(cmd);
}