/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_LOANS_ARN
	STORAGE_LOANS_NAME
	STORAGE_LOANS_STREAMARN
Amplify Params - DO NOT EDIT */

const endpoints = require('./endpoints.js');

exports.handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  switch (event.httpMethod) {
    case 'GET':
      return await exports.getHandler(event);
    case 'PATCH':
      return await exports.patchHandler(event);
    case 'POST':
      return await exports.postHandler(event);
  }
};

exports.getHandler = async (event) => {
  switch (event.resource) {
    case '/ledger':
      return await endpoints.getLedger(event);
  }
};

exports.patchHandler = async (event) => {
  switch (event.resource) {
    case '/gifts/{id}':
      return await endpoints.redeemGift(event);
  }
}

exports.postHandler = async (event) => {
  switch (event.resource) {
    case '/loans':
      return await endpoints.requestLoan(event);
    case '/loans/{id}':
      return await endpoints.payOffLoan(event);
  }
}