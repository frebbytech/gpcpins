const { createClient } = require("redis");
const { Server } = require("socket.io");
const logger = require("../utils/logger");
const { createAdapter } = require("@socket.io/redis-adapter");

let io = null;
let pubClient = null;

// CORS configuration
const allowedList = process.env.WHITELIST?.split(",") || [];
const whitelist = [...allowedList, process.env.CLIENT_URL];

const initSocketServer = async (server) => {
  io = new Server(server, {
    transports: ["websocket"],
    cors: {
      origin: whitelist,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  /*
|--------------------------------------------------------------------------
| REDIS CLIENTS
|--------------------------------------------------------------------------
|
| pubClient  -> publish socket events
| subClient  -> subscribe socket events
|
*/

  pubClient = createClient({
    url: process.env.REDIS_HOST_EXT,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
      connectTimeout: 10000, // Time allowed to establish a connection (10s)
      keepAlive: 5000, // Keep-alive packets interval
    },
  });

  const subClient = pubClient.duplicate();

  await pubClient.connect();
  await subClient.connect();

  logger.info("Redis connected");

  pubClient.on("error", (err) => {
    logger.error("Redis Pub Error:", err);
  });

  subClient.on("error", (err) => {
    logger.error("Redis Sub Error:", err);
  });

  /*
    |--------------------------------------------------------------------------
    | SOCKET REDIS ADAPTER
    |--------------------------------------------------------------------------
    */

  io.adapter(createAdapter(pubClient, subClient));

  /*
|--------------------------------------------------------------------------
| SOCKET INIT FUNCTION (FIX FOR COMMONJS)
|--------------------------------------------------------------------------
*/

  return {
    io,
    pubClient,
  };
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized yet");
  }
  return io;
};

// New getter function for the Redis Pub Client
const getPubClient = () => {
  if (!pubClient) throw new Error("Redis Pub Client not initialized yet");
  return pubClient;
};

module.exports = {
  initSocketServer,
  getIO,
  getPubClient,
};
