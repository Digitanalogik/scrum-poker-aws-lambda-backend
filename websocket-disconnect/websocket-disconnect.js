// Scrum Poker API: WebSocket Disconnect - Tatu Soininen, 2023
// AWS Lambda function to remove a player from DynamoDB table
// and inform other players when somebody is disconnected from the game.

import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

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

    // To find other players in the same virtual room, we need both room name & secret
    const roomName = player.roomName.S;
    const roomSecret = player.roomSecret.S;    

    await deletePlayer(id, playerName);

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
    const message = `{"action":"player-disconnect","name":"${playerName}","id":"${id}"}`;
    console.log("Send logout message to others: ", message);

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
        body: JSON.stringify({ message: "Error while disconnecting player" }),
      };  
    }
    // Return 200 status code if all messages were sent successfully
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Player disconnected" }),
    };
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Player not found" }),
  };
};
