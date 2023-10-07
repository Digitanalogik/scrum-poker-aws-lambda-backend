// Scrum Poker API: WebSocket Default handler - Tatu Soininen, 2023

export const handler = async (event) => {

  console.log("LAMBDA - WEBSOCKET DEFAULT - EVENT: ", event);

  return {
    statusCode: 200,
    body: "OK",
  };
};
