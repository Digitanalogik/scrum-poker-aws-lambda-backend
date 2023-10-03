// Scrum Poker API: Player controller - Tatu Soininen, 2023
// AWS Lambda function to store player data in DynamoDB table

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {

  console.log("LAMBDA KUTSUTTU! event = ", JSON.stringify(event));

  try {
    const body = JSON.parse(event.body);

    const playerName = body.playerName;
    const roomName = body.roomName;
    const roomSecret = body.roomSecret; // This is optional, thus not checked to exist

    // Check required fields
    let errors = [];

    if (!playerName) {
      errors.push('playerName');
    }

    if (!roomName) {
      errors.push('roomName');
    }

    if (errors.length > 0) {
      const errorMessage = 'Error! Required JSON fields missing: ' + errors.join(', ');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: errorMessage })
      };
    }

    // Generate a unique ID for the player, ToDo: use better method
    const timestamp = new Date().getTime().toString();

    // Define the document for DynamoDB
    const dataToStore = {
      id: timestamp,
      playerName: playerName,
      roomName: roomName,
      roomSecret: roomSecret,
      lastLogin: timestamp
    };

    console.log("SCRUM POKER DATA - PLAYER:\n", dataToStore)

    // Using PutItem
    const command = new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: dataToStore,
    });
  
    // Execute DynamoDB command
    const response = await docClient.send(command);
    console.log("DynamoDB response: ", response);
  
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Player entered the game!', playerId: timestamp }),
    };

  } catch (error) {

    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
