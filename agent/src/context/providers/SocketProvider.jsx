// src/context/SocketProvider.jsx

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import _ from "lodash";
import { io } from "socket.io-client";
import { useAuth } from "./AuthProvider";

/*
|--------------------------------------------------------------------------
| SOCKET CONTEXT
|--------------------------------------------------------------------------
*/

const SocketContext = createContext(null);

/*
|--------------------------------------------------------------------------
| SOCKET PROVIDER
|--------------------------------------------------------------------------
*/

export const SocketProvider = ({ children }) => {
  const { user, accessToken } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  // const userId = user?.id;

  /*
  |--------------------------------------------------------------------------
  | INITIALIZE SOCKET
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    /*
      Prevent duplicate connections

      token
    */

    // if (!user?.id) return;
    if (socketRef.current) return;

    const socket = io(import.meta.env.VITE_API_URL, {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      timeout: 20000,

      auth: {
        token: accessToken || "",
      },
    });

    socketRef.current = socket;

    /*
    |--------------------------------------------------------------------------
    | CONNECTED
    |--------------------------------------------------------------------------
    */

    socket.on("connect", () => {
      // console.log("Socket Connected:", socket?.id);

      setConnected(true);
      setSocketId(socket?.id);
      if (!_.isEmpty(user)) {
        socket.emit("join-user-room", user?.id);
      }
    });

    /*
    |--------------------------------------------------------------------------
    | DISCONNECTED
    |--------------------------------------------------------------------------
    */

    socket.on("disconnect", (reason) => {
      console.log("Socket Disconnected:", reason);

      setConnected(false);
      setSocketId(null);
    });

    /*
    |--------------------------------------------------------------------------
    | SOCKET ERROR
    |--------------------------------------------------------------------------
    */

    socket.on("connect_error", (error) => {
      if (
        error.message === "xhr poll error" ||
        error.message === "websocket error"
      ) {
        console.warn("Socket transport fallback active... connecting.");
      } else {
        console.error("Critical Socket Error:", error.message);
      }
    });

    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-user-room", user?.id);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setSocketId(null);
    };
    // Only re-run if the specific user ID (or token) actually changes,
    // not on every new `user` object reference from AuthProvider.
  }, [user, accessToken]);

  /*
  |--------------------------------------------------------------------------
  | JOIN PAYMENT ROOM
  |--------------------------------------------------------------------------
  */

  const joinPaymentRoom = (txRef) => {
    if (!txRef) return;

    socketRef.current?.emit("join-payment-room", txRef);
  };

  /*
  |--------------------------------------------------------------------------
  | LEAVE PAYMENT ROOM
  |--------------------------------------------------------------------------
  */

  const leavePaymentRoom = (txRef) => {
    if (!txRef) return;

    socketRef.current?.emit("leave-payment-room", txRef);
  };

  /*
  |--------------------------------------------------------------------------
  | GENERIC EVENT EMITTER
  |--------------------------------------------------------------------------
  */

  const emitEvent = (event, payload = {}) => {
    socketRef.current?.emit(event, payload);
  };

  /*
  |--------------------------------------------------------------------------
  | GENERIC EVENT LISTENER
  |--------------------------------------------------------------------------
  */

  const onEvent = (event, callback) => {
    socketRef.current?.on(event, callback);
  };

  /*
  |--------------------------------------------------------------------------
  | REMOVE EVENT LISTENER
  |--------------------------------------------------------------------------
  */

  const offEvent = (event, callback) => {
    socketRef.current?.off(event, callback);
  };

  /*
  |--------------------------------------------------------------------------
  | RECONNECT WITH NEW TOKEN
  |--------------------------------------------------------------------------
  */

  const reconnectSocket = () => {
    if (!socketRef.current) return;

    socketRef.current.auth = {
      token: accessToken || "",
    };

    socketRef.current.disconnect();

    socketRef.current.connect();
  };

  /*
  |--------------------------------------------------------------------------
  | CONTEXT VALUE
  |--------------------------------------------------------------------------
  */

  const value = useMemo(
    () => ({
      socket: socketRef.current,

      connected,

      socketId,

      joinPaymentRoom,

      leavePaymentRoom,

      emitEvent,

      onEvent,

      offEvent,

      reconnectSocket,
    }),
    // accessToken is included so `reconnectSocket` never closes over a
    // stale token if it refreshes while the socket stays connected.
    [connected, socketId, accessToken],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

/*
|--------------------------------------------------------------------------
| USE SOCKET HOOK
|--------------------------------------------------------------------------
*/

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return context;
};
