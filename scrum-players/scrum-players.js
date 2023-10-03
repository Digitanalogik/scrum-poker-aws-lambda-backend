// Scrum Poker API: Players controller - Tatu Soininen, 2023
// AWS Lambda function to get all players from DynamoDB table

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {

  console.log("SCRUM POKER LAMBDA - EVENT:\n", event);

  try {
    const scanCommand = new ScanCommand({
      TableName: DYNAMODB_TABLE,
    });

    // Execute DynamoDB command
    const response = await docClient.send(scanCommand);
    console.log("DynamoDB response: ", response);

    if (response.Items) {
      return {
        statusCode: 200,
        body: JSON.stringify(response.Items),
      };
    } else {
      return {
        statusCode: 404,
        body: "No players",
      };
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error retrieving data from DynamoDB' }),
    };
  }
};