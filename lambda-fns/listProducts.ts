const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

async function listProducts() {
  const params = {
    TableName: process.env.PRODUCT_TABLE,
  };
  try {
    const { Items } = await docClient.scan(params).promise();
    return Items;
  } catch (err) {
    console.log("DynamoDB error: ", err);
    return null;
  }
}

export default listProducts;
