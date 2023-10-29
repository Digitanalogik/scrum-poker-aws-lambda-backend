// Scrum Poker API: Players controller - Tatu Soininen, 2023
// AWS Lambda function to get all players from DynamoDB table

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

// Account specific configuration, change these if needed
const AWS_REGION = "eu-north-1";
const DYNAMODB_TABLE = "ScrumPokerPlayer";

const client = new DynamoDBClient({ region: AWS_REGION });

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

  console.log("DynamoDB scan response: ", response);

  if (response.Items) {
    console.log("DynamoDB scan found these players in the same room: ", response.Items);
    return response.Items;
  } else {
    console.log("No players found in DynamoDB.");
    return null;
  }
};

export const handler = async (event) => {

  console.log("SCRUM POKER LAMBDA - EVENT:\n", event);

  const room = event.queryStringParameters.room;
  const secret = event.queryStringParameters.secret;

  console.log("Searching for players in room: ", room, " with secret: ", secret);

  const players = await findPlayersByRoom(room, secret);
  console.log("DynamoDB scan found these players in the same room: ", players.map(p => p.playerName.S));

  const dtoPlayers = players.map(p => { return { id: p.id.S, name: p.playerName.S }});

  // Sort players by id descending (timestamp)
  dtoPlayers.sort((a, b) => b.id.localeCompare(a.id));

  return {
    statusCode: 200,
    body: JSON.stringify(dtoPlayers),
  };
};