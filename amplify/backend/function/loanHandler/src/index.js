/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_LOANS_ARN
	STORAGE_LOANS_NAME
	STORAGE_LOANS_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient, QueryCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const dynamoClient = new DynamoDBClient({});
const snsClient = new SNSClient({});

exports.handler = async (event) => {
    console.log(`EVENT: ${JSON.stringify(event)}`);

  switch (event.resource) {
    case '/loans':
      return await exports.getLoans();
    case '/loans/{proxy+}':
      return await exports.redeemLoan(event.path.replace('/loans/', ''))
    default:
      return exports.buildResponse(500, { message: 'Invalid Operation' });
  }
};

exports.getLoans = async () => {
  const cmd = new QueryCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: 'loan' }
    }
  });

  const { Items } = await dynamoClient.send(cmd);

  return exports.buildResponse(200, {
    items: Items.map((item) => ({
      redeemed: item.redeemed.BOOL,
      redemptionTime: item.time?.S,
      id: item.sk.S,
      value: item.value.N
    }))
  });
};

exports.redeemLoan = async (id) => {
  const updateCmd = new UpdateItemCommand({
    TableName: process.env.STORAGE_LOANS_NAME,
    Key: {
      pk: { S: 'loan' },
      sk: { S: `${id}` }
    },
    ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk) AND #redeemed = :false',
    UpdateExpression: 'SET #redeemed = :redeemed, #time = :time',
    ExpressionAttributeNames: {
      '#redeemed': 'redeemed',
      '#time': 'time'
    },
    ExpressionAttributeValues: {
      ':redeemed': { BOOL: true },
      ':time': { S: new Date().toISOString() },
      ':false': { BOOL: false }
    },
    ReturnValues: 'ALL_NEW'
  });

  const { Attributes} = await dynamoClient.send(updateCmd);

  const notifyCmd = new PublishCommand({
    TopicArn: 'arn:aws:sns:us-east-2:276500115121:loan-topic-katybdayapp-staging',
    Message: `Katy is requesting $${Attributes.value.N}`,
    Subject: 'Loan Requested'
  });

  await snsClient.send(notifyCmd);

  return exports.buildResponse(204, { message: 'Loan Redeemed' });
};

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
