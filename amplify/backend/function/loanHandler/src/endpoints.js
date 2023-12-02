const { DynamoDBClient, QueryCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const ULID = require('ulid');

const dynamoClient = new DynamoDBClient({});
const snsClient = new SNSClient({});

const SUPER_ADMIN_SUFFIX = 'CognitoSignIn:958a0a61-7f30-43e0-8007-075d5646ca12';

exports.getLedger = async (event) => {
  const cmd = new QueryCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: 'ledger' }
    }
  });

  const { Items } = await dynamoClient.send(cmd);

  const gifts = Items.filter((x) => x.type.S === 'gift').map((x) => ({
    redeemed: x.redeemed.BOOL,
    createTime: 
    redemptionTime: x.time?.S,
    id: x.sk.S,
    value: x.value.N
  }));

  const loans = Items.filter((x) => x.type.S === 'loan').map((x) => ({
    requestTime: x.time.S,
    paidOff: x.paidOff.BOOL,
    id: x.sk.S,
    value: x.value.N
  }));

  const stats = {
    totalGifted: gifts.reduce((a, b) => a + b.value, 0),
    totalLent: loans.reduce((a, b) => a + b.value, 0),
    debt: loans.filter((x) => !x.paidOff).reduce((a, b) => a + b.value, 0)
  };

  return exports.buildResponse(200, { stats, gifts, loans });
}

exports.addGift = async (event) => {
  if (!isSuperAdmin(event)) {
    return exports.buildResponse(401, {
      message: 'Unauthorized'
    });
  }

  const { value } = JSON.parse(event.body);

  const cmd = new PutItemCommand({
    pk: { S: 'ledger' },
    sk: { S: `${ULID.ulid()}` },
    redeemed: { BOOL: false },
    createdDate: { S: new Date().toISOString() },
    type: { S: 'gift' },
    value: { N: value }
  });

  await dynamoClient.send(cmd);
};

exports.redeemGift = async (event) => {
  const { id } = event.pathParameters;

  const updateCmd = new UpdateItemCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    Key: {
      pk: { S: 'ledger' },
      sk: { S: `${id}` }
    },
    ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND #redeemed = :false AND #type = :gift',
    UpdateExpression: 'SET #redeemed = :redeemed, #redemptionTime = :time',
    ExpressionAttributeNames: {
      '#redeemed': 'redeemed',
      '#redemptionTime': 'redemptionTime',
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':redeemed': { BOOL: true },
      ':time': { S: new Date().toISOString() },
      ':false': { BOOL: false },
      ':gift': { S: 'gift' }
    },
    ReturnValues: 'ALL_NEW'
  });

  const { Attributes } = await dynamoClient.send(updateCmd);

  const notifyCmd = new PublishCommand({
    TopicArn: 'arn:aws:sns:us-east-2:276500115121:loan-topic-katybdayapp-staging',
    Message: `Katy redeemed gift ${Attributes.sk.S} for $${Attributes.value.N}`,
    Subject: 'Gift Redeemed'
  });

  await snsClient.send(notifyCmd);

  return exports.buildResponse(204, { message: 'Gift Redeemed' });
};

exports.requestLoan = async (event) => {
  const { value } = JSON.parse(event.body);

  const cmd = new PutItemCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    Item: {
      pk: { S: 'ledger' },
      sk: { S: `${ULID.ulid()}` },
      requestTime: { S: new Date().toISOString() },
      paidOff: { BOOL: false },
      type: { S: 'loan' },
      value: { N: value }
    }
  });

  await dynamoClient.send(cmd);

  const notifyCmd = new PublishCommand({
    TopicArn: 'arn:aws:sns:us-east-2:276500115121:loan-topic-katybdayapp-staging',
    Message: `Katy is requesting $${Attributes.value.N}`,
    Subject: 'Loan Requested'
  });

  await snsClient.send(notifyCmd);

  return exports.buildResponse(204, { message: 'Gift Redeemed' });
};

exports.payOffLoan = async (event) => {
  const { id } = event.pathParameters;

  const updateCmd = new UpdateItemCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    Key: {
      pk: { S: 'ledger' },
      sk: { S: `${id}` }
    },
    ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND #paidOff = :false AND #type = :loan',
    UpdateExpression: 'SET #paidOff = :true, #payOffTime = :time',
    ExpressionAttributeNames: {
      '#paidOff': 'paidOff',
      '#payOffTime': 'payOffTime',
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':time': { S: new Date().toISOString() },
      ':false': { BOOL: false },
      ':true': { BOOL: true },
      ':loan': { S: 'loan' }
    }
  });

  await dynamoClient.send(updateCmd);

  const notifyCmd = new PublishCommand({
    TopicArn: 'arn:aws:sns:us-east-2:276500115121:loan-topic-katybdayapp-staging',
    Message: `Katy paid off loan $${id}`,
    Subject: 'Loan Paid Off'
  });

  await snsClient.send(notifyCmd);

  return exports.buildResponse(204, { message: 'Gift Redeemed' });
}

exports.buildResponse = (statusCode, body) => {
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