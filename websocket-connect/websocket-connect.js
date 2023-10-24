// Scrum Poker API: WebSocket Connect - Tatu Soininen, 2023
// AWS Lambda function to update connectionId of a player in DynamoDB table
// and inform other players that a new player has joined the game.

import { DynamoDBClient, ScanCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const findPlayer = async (id, name) => {
  try {
    const params = {
      TableName: DYNAMODB_TABLE,
      Key: {
        id: { S: id },
        playerName: { S: name }
      }
    };

    const command = new GetItemCommand(params);
    const response = await docClient.send(command);
    console.log("Player found: ", response);
    return response;
  } catch (error) {
    console.error("Error while searching the player: ", error);
    throw error;
  }
};


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

const findPlayersByRoom = async (roomName, roomSecret) => {
  const params = {
    TableName: DYNAMODB_TABLE,
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

  console.log("LAMBDA - WEBSOCKET CONNECT - EVENT: ", event);

  const id = event.queryStringParameters.id;
  const name = event.queryStringParameters.name;
  const connectionId = event.requestContext.connectionId;

  console.log("Updating connection for player: " + name + " (" + id + ")");
  const result = await updatePlayerConnection(id, name, connectionId);

  if (result['$metadata'].httpStatusCode  === 200) {

    console.log("Informing other players about new contender.");
    const player = await findPlayer(id, name);

    if (player) {
      const roomName = player.Item.roomName.S;
      const roomSecret = player.Item.roomSecret.S;
      console.log("Room: ", roomName, " - ", roomSecret);

      const players = await findPlayersByRoom(roomName, roomSecret);
      console.log("DynamoDB scan found these players in the same room: ", players.map(p => p.playerName.S));

      // Get the domain name and stage from the event
      const domain = event.requestContext.domainName;
      const stage = event.requestContext.stage;
      const API_ENDPOINT = `https://${domain}/${stage}`;

      // Create an instance of the ApiGatewayManagementApiClient to send messages to connections
      const callbackAPI = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        endpoint: API_ENDPOINT
      });

      // Generate the login message
      const message = `{"action":"player-join","name":"${name}","id":"${id}"}`;
      console.log("Send login message to others: ", message);

      // Send the message to all connections except the sender
      const sendMessages = players.map(async ({ connectionId }) => {
        if (connectionId !== event.requestContext.connectionId) {
          try {
            // Create a new PostToConnectionCommand with the connectionId and message
            const command = new PostToConnectionCommand({
              ConnectionId: connectionId.S,
              Data: message
            });
    
            console.log("Posting to connection: ", API_ENDPOINT, connectionId.S, message);
    
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
        };
      }
    }
    // Return 200 status code if all messages were sent successfully
    return {
      statusCode: 200,
    };
  }

  // Return unique error message (teapot), should have exited earlier
  return {
    statusCode: 418,
  };

};