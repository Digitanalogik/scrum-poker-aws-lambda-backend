// Scrum Poker API: WebSocket Connect - Tatu Soininen, 2023
// AWS Lambda function to update connectionId of a player in DynamoDB table

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const updatePlayerConnection = async (id, name, connectionId) => {
  try {
    const params = {
      TableName: DYNAMODB_TABLE,
      Key: {
        id: { S: id },
        playerName: { S: name }
      },
      UpdateExpression: "SET connectionId = :connectionId",
      ExpressionAttributeValues: {
        ":connectionId": { S: connectionId },
      },
      ReturnValues: "UPDATED_NEW",
    };

    const command = new UpdateItemCommand(params);
    const response = await docClient.send(command);
    console.log("Connection established! DynamoDB response: ", response);
    return response;
  } catch (error) {
    console.error("Error while connecting: ", error);
    throw error;
  }
};

export const handler = async (event) => {

  console.log("LAMBDA - WEBSOCKET CONNECT - EVENT: ", event);

  const id = event.queryStringParameters.id;
  const name = event.queryStringParameters.name;
  const connectionId = event.requestContext.connectionId;

  try {
    console.log("Updating connection for player: " + name + " (" + id + ")");
    const result = await updatePlayerConnection(id, name, connectionId);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error updating connectionId" }),
    };
  }
};
