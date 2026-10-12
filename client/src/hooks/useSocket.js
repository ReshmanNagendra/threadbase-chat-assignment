import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";

export function useSocket(roomId) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // 1. Guard against missing authentication token
    if (!token) return;

    // 2. Initialize Socket.IO connection with auth token
    const s = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token },
    });

    setSocket(s);

    // 3. Emit room join event
    s.emit("room:join", roomId);

    // 4. Set up message listener
    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    s.on("chat:message", onMessage);

    // 5. Cleanup listener and connection on unmount / re-render
    return () => {
      s.off("chat:message", onMessage);
      s.disconnect();
    };
  }, [token, roomId]);

  // Handler to emit outgoing messages
  const sendMessage = useCallback(
    (text) => {
      socket?.emit("chat:message", { roomId, text });
    },
    [socket, roomId]
  );

  return { messages, sendMessage };
}