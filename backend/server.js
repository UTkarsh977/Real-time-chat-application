const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Store messages (temporary)
let messages = [];

// Socket connection
io.on("connection", (socket) => {
  console.log("✅ User connected");

  // Send old messages to new user
  socket.emit("history", messages);

  // When user sends message
  socket.on("send_message", (msg) => {
    console.log("📩 Message:", msg);

    messages.push(msg);

    // Send to all users
    io.emit("receive_message", msg);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

// Start server
const PORT = 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});