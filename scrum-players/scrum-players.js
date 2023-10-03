// Scrum Poker API: Players controller - Tatu Soininen, 2023
// AWS Lambda function to get all players from DynamoDB table

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerVote";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {

  console.log("SCRUM POKER LAMBDA - EVENT:\n", event);

  try {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE,
    });

    const response = await docClient.send(scanCommand);

    return {
      statusCode: 200,
      body: JSON.stringify(response.Items),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error retrieving data from DynamoDB' }),
    };
  }
};