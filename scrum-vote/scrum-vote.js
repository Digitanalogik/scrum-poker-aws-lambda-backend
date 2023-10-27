// Scrum Poker API: Vote controller - Tatu Soininen, 2023
// AWS Lambda function to store game data in DynamoDB table
// and signal through WebSocket connection to inform other players in the same room

import { DynamoDBClient, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE_VOTE = "ScrumPokerVote";
const DYNAMODB_TABLE_PLAYER = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const findPlayer = async (id, name) => {
  try {
    const params = {
      TableName: DYNAMODB_TABLE_PLAYER,
      Key: {
        id: { S: id },
        playerName: { S: name }
      }
    };

    console.log("Find player: ", name, id);

    const command = new GetItemCommand(params);
    const response = await docClient.send(command);
    console.log("Player found: ", response);
    return response;
  } catch (error) {
    console.error("Error while searching the player: ", error);
    throw error;
  }
};

const findPlayersByRoom = async (roomName, roomSecret) => {
  const params = {
    TableName: DYNAMODB_TABLE_PLAYER,
    FilterExpression: "roomName = :roomName and roomSecret = :roomSecret",
    ExpressionAttributeValues: {
      ":roomName": { S: roomName },
      ":roomSecret": { S: roomSecret },
    },
  };

  console.log("Scanning DynamoDB for other players");

  const command = new ScanCommand(params);
  const response = await client.send(command);

  if (response.Items && response.Items.length > 0) {
    console.log("DynamoDB scan found these players in the same room: ", response.Items);
    return response.Items;
  } else {
    console.log("No players found in DynamoDB.");
    return null;
  }
};

export const handler = async (event) => {

  console.log("SCRUM POKER LAMBDA - EVENT:\n", event);

  try {

    const body = JSON.parse(event.body);

    const playerId = body.playerId;
    const playerName = body.playerName;
    const roomName = body.roomName;
    const roomSecret = body.roomSecret; // This is optional, thus not checked to exist
    const cardValue = body.cardValue;
    const cardTitle = body.cardTitle;

    // Accept vote only from a known player
    const player = await findPlayer(playerId, playerName);
    if (!player) {
      const errorMessage = `Error! Player not found: ${playerName} (${playerId})`;
      return {
        statusCode: 400,
        body: JSON.stringify({ message: errorMessage })
      };
    }

    const currentPlayerConnectionId = player.Item.connectionId.S;

    // Check required fields
    let errors = [];

    if (!playerId) {
      errors.push('playerId');
    }

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
      playerId,
      playerName,
      roomName,
      roomSecret,
      cardValue,
      cardTitle,
      timestamp: timestamp
    };

    console.log("SCRUM SCRUM POKER DATA - VOTE:\n", dataToStore);

    // Using PutItem
    const command = new PutCommand({
      TableName: DYNAMODB_TABLE_VOTE,
      Item: dataToStore,
    });
  
    // Execute DynamoDB command
    const response = await docClient.send(command);
    console.log("DynamoDB response: ", response);
  
    const players = await findPlayersByRoom(roomName, roomSecret);
    console.log("DynamoDB scan found these players in the same room: ", players.map(p => p.playerName.S));

    console.log("CONNECTIONS_API: ", process.env.CONNECTIONS_API);

    // Create an instance of the ApiGatewayManagementApiClient to send messages to connections
    const callbackAPI = new ApiGatewayManagementApiClient({
      apiVersion: '2018-11-29',
      endpoint: process.env.CONNECTIONS_API
    });

    // Generate the login message
    const message = `{"action":"player-vote","name":"${playerName}","id":"${playerId}","cardValue":"${cardValue}","cardTitle":"${cardTitle}"}`;
    console.log("Send vote message to others: ", message);

    // Send the message to all connections except the sender
    const sendMessages = players.map(async ({ connectionId }) => {
      if (connectionId !== currentPlayerConnectionId) {
        try {
          // Create a new PostToConnectionCommand with the connectionId and message
          const command = new PostToConnectionCommand({
            ConnectionId: connectionId.S,
            Data: message
          });
  
          console.log("Posting to connection: ", process.env.CONNECTIONS_API, connectionId.S, message);
  
          // Send the message to the connection using the ApiGatewayManagementApiClient
          await callbackAPI.send(command);
        } catch (e) {
          console.log("ERROR DESCRIPTION: ", e);
        }
      }
    });
    
    try {
      // Wait for all messages to be sent before returning a response
      await Promise.all(sendMessages);
    } catch (e) {
      console.log(e);
      // Return 500 error if there was an error sending messages
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Error while processing the vote" }),
      };  
    }
    // Return 200 status code if all messages were sent successfully
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Vote accepted!' }),
    };
  } catch (error) {
    console.error("Error while processing the vote: ", error);
    // Return 500 error if there was an error sending messages
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error while processing the vote" }),
    };  
  }
};
