// Scrum Poker API: WebSocket Disconnect - Tatu Soininen, 2023
// AWS Lambda function to remove a player from DynamoDB when connectionId is disconnected

import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });

const findPlayerByConnectionId = async (connectionId) => {
  const params = {
    TableName: DYNAMODB_TABLE,
    FilterExpression: "connectionId = :connectionId",
    ExpressionAttributeValues: {
      ":connectionId": { S: connectionId },
    },
  };

  const command = new ScanCommand(params);
  const response = await client.send(command);

  if (response.Items && response.Items.length > 0) {
    return response.Items[0];
  } else {
    return null;
  }
};

const deletePlayer = async (id, playerName) => {
  const params = {
    TableName: DYNAMODB_TABLE,
    Key: {
      id: { S: id },
      playerName: { S: playerName },
    },
  };

  const command = new DeleteItemCommand(params);
  await client.send(command);
};

export const handler = async (event) => {

  console.log("LAMBDA - WEBSOCKET DISCONNECT - EVENT: ", event);

  const connectionId = event.requestContext.connectionId;
  const player = await findPlayerByConnectionId(connectionId);

  if (player) {
    const id = player.id.S;
    const playerName = player.playerName.S;

    try {
      await deletePlayer(id, playerName);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Player removed" }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Error removing player" }),
      };
    }
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Player not found" }),
    };
  }
};