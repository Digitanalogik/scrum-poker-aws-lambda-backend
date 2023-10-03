// Scrum Poker API: Vote controller - Tatu Soininen, 2023
// AWS Lambda function to store game data in DynamoDB table

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Account specific configuration, change these if needed
const client = new DynamoDBClient({ region: "eu-north-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {

  console.log("SCRUM POKER LAMBDA - EVENT:\n", event);

  try {
    const body = JSON.parse(event.body);

    const playerName = body.playerName;
    const roomName = body.roomName;
    const roomSecret = body.roomSecret; // This is optional, thus not checked to exist
    const cardValue = body.cardValue;
    const cardTitle = body.cardTitle;

    // Check required fields
    let errors = [];

    if (!playerName) {
      errors.push('playerName');
    }

    if (!roomName) {
      errors.push('roomName');
    }

    if (!cardValue && cardValue !== 0) {
      errors.push('cardValue');
    }

    if (!cardTitle) {
      errors.push('cardTitle');
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
      playerName,
      roomName,
      roomSecret,
      cardValue,
      cardTitle,
      timestamp: new Date().getTime().toString()
    };

    console.log("SCRUM SCRUM POKER DATA - VOTE:\n", dataToStore)

    // Using PutItem
    const command = new PutCommand({
      TableName: "ScrumPoker",
      Item: dataToStore,
    });
  
    // Execute DynamoDB command
    const response = await docClient.send(command);
    console.log("DynamoDB response: ", response);
  
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Vote accepted!' }),
    };

  } catch (error) {

    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};