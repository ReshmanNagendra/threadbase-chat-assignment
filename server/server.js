import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "./middleware/auth.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Demo users - log in as either to test chat in two windows.
const USERS = [
  { userId: 1, name: "Ada", email: "ada@threadbase.dev", password: "password" },
  { userId: 2, name: "Linus", email: "linus@threadbase.dev", password: "password" },
];

// POST /auth/login -> { accessToken, user }
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const found = USERS.find((u) => u.email === email && u.password === password);
  if (!found) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = jwt.sign(
    { userId: found.userId, name: found.name },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  res.json({ accessToken, user: { userId: found.userId, name: found.name } });
});

// A normal protected route (unchanged, uses the HTTP verifyToken).
app.get("/api/me", verifyToken, (req, res) => res.json({ user: req.user }));

// 1. Create HTTP server and attach Socket.io instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

// 2. Task 2: Authenticate sockets with JWT middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.user = decoded; // attach payload { userId, name } to socket
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid or expired token"));
  }
});

// 3. Handle connections and room events
io.on("connection", (socket) => {
  // Join room event
  socket.on("room:join", (roomId) => {
    socket.join(roomId);
  });

  // Chat message event
  socket.on("chat:message", ({ roomId, text }) => {
    const message = {
      id: Date.now().toString(),
      text,
      sender: socket.data.user, // Attach authenticated user details
      createdAt: new Date().toISOString(),
    };

    // Broadcast message to all sockets in the specific room
    io.to(roomId).emit("chat:message", message);
  });
});

// 4. Start the server via httpServer.listen
const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
  console.log("  POST /auth/login");
  console.log("  Socket.io: Ready and listening");
});