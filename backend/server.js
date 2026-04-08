const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "*";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/realtime-chat";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

const DEFAULT_ROOMS = ["General", "Engineering", "Design", "Random"];
const ROOM_PREFIX = "room:";
const DIRECT_PREFIX = "direct:";
const ALLOWED_ORIGINS = CLIENT_URL.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (ALLOWED_ORIGINS.length === 0) {
    return true;
  }

  if (ALLOWED_ORIGINS.includes("*")) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

const roomMessages = new Map(DEFAULT_ROOMS.map((room) => [room, []]));
const privateMessages = new Map();
const connectedUsers = new Map();

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function sanitizeRoomName(name = "") {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

function getRoomKey(roomName) {
  return `${ROOM_PREFIX}${roomName}`;
}

function getDirectKey(userA, userB) {
  return [userA, userB].sort().join(":");
}

function getDirectChannel(userA, userB) {
  return `${DIRECT_PREFIX}${getDirectKey(userA, userB)}`;
}

function getAvailableRooms() {
  return Array.from(roomMessages.keys())
    .map((name) => ({
      name,
      members: Array.from(connectedUsers.values()).filter(
        (user) => user.currentRoom === name
      ).length,
      messages: roomMessages.get(name)?.length || 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getOnlineUserMap() {
  const users = new Map();

  connectedUsers.forEach((value) => {
    users.set(value.userId, {
      userId: value.userId,
      name: value.name,
      email: value.email,
      currentRoom: value.currentRoom,
      status: "online",
    });
  });

  return users;
}

async function getUsersWithStatus(currentUserId) {
  const records = await User.find({})
    .select("_id name email")
    .sort({ name: 1 })
    .lean();

  const onlineUsers = getOnlineUserMap();

  return records
    .map((record) => {
      const id = record._id.toString();
      const onlineProfile = onlineUsers.get(id);

      return {
        userId: id,
        name: record.name,
        email: record.email,
        currentRoom: onlineProfile?.currentRoom || null,
        status: onlineProfile ? "online" : "offline",
      };
    })
    .filter((record) => record.userId !== currentUserId);
}

async function emitPresence(io) {
  const sockets = await io.fetchSockets();

  await Promise.all(
    sockets.map(async (activeSocket) => {
      const users = await getUsersWithStatus(activeSocket.user.userId);
      activeSocket.emit("users:list", users);
    })
  );

  io.emit("rooms:list", getAvailableRooms());
}

function joinUserToRoom(socket, roomName) {
  const normalizedRoom = sanitizeRoomName(roomName);

  if (!normalizedRoom || !roomMessages.has(normalizedRoom)) {
    return { ok: false, message: "That room is not available." };
  }

  const userState = connectedUsers.get(socket.id);

  if (!userState) {
    return { ok: false, message: "User connection state was not found." };
  }

  const previousRoom = userState.currentRoom;

  if (previousRoom) {
    socket.leave(getRoomKey(previousRoom));
  }

  userState.currentRoom = normalizedRoom;
  connectedUsers.set(socket.id, userState);
  socket.join(getRoomKey(normalizedRoom));

  const messages = roomMessages.get(normalizedRoom) || [];
  socket.emit("room:joined", {
    room: normalizedRoom,
    messages,
  });

  return {
    ok: true,
    room: normalizedRoom,
    messages,
  };
}

app.get("/", (_req, res) => {
  res.json({ message: "Realtime chat backend is running." });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Unable to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = createToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to log in." });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Profile lookup error:", error);
    return res.status(500).json({ message: "Unable to load user profile." });
  }
});

app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const users = await getUsersWithStatus(req.user.userId);
    return res.json({ users });
  } catch (error) {
    console.error("Users lookup error:", error);
    return res.status(500).json({ message: "Unable to load users." });
  }
});

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required."));
  }

  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return next(new Error("Invalid or expired token."));
  }
});

io.on("connection", async (socket) => {
  const profile = {
    userId: socket.user.userId,
    name: socket.user.name,
    email: socket.user.email,
    currentRoom: DEFAULT_ROOMS[0],
  };

  connectedUsers.set(socket.id, profile);
  socket.join(getRoomKey(profile.currentRoom));

  socket.emit("rooms:list", getAvailableRooms());
  socket.emit("room:joined", {
    room: profile.currentRoom,
    messages: roomMessages.get(profile.currentRoom) || [],
  });

  await emitPresence(io);
  console.log(`User connected: ${profile.email}`);

  socket.on("rooms:create", async (roomName, callback = () => {}) => {
    const normalizedRoom = sanitizeRoomName(roomName);

    if (!normalizedRoom) {
      callback({ ok: false, message: "Room name is required." });
      return;
    }

    if (!roomMessages.has(normalizedRoom)) {
      roomMessages.set(normalizedRoom, []);
    }

    const result = joinUserToRoom(socket, normalizedRoom);
    await emitPresence(io);
    callback(result);
  });

  socket.on("rooms:join", async (roomName, callback = () => {}) => {
    const result = joinUserToRoom(socket, roomName);

    if (!result.ok) {
      callback(result);
      return;
    }

    await emitPresence(io);
    callback(result);
  });

  socket.on("room:message", (payload, callback = () => {}) => {
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    const room = sanitizeRoomName(payload?.room || "");
    const userState = connectedUsers.get(socket.id);

    if (!userState) {
      callback({ ok: false, message: "User connection state was not found." });
      return;
    }

    if (!text) {
      callback({ ok: false, message: "Message cannot be empty." });
      return;
    }

    if (!room || !roomMessages.has(room)) {
      callback({ ok: false, message: "Room not found." });
      return;
    }

    if (userState.currentRoom !== room) {
      callback({ ok: false, message: "Join the room before sending a message." });
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: "room",
      room,
      senderId: socket.user.userId,
      senderName: socket.user.name,
      text,
      time: new Date().toLocaleTimeString(),
    };

    roomMessages.get(room).push(message);
    io.to(getRoomKey(room)).emit("room:message", message);
    io.emit("rooms:list", getAvailableRooms());
    callback({ ok: true });
  });

  socket.on("private:open", ({ recipientId }, callback = () => {}) => {
    if (!recipientId || recipientId === socket.user.userId) {
      callback({ ok: false, message: "Choose another user to start a private chat." });
      return;
    }

    const channel = getDirectChannel(socket.user.userId, recipientId);
    const key = getDirectKey(socket.user.userId, recipientId);
    socket.join(channel);
    const messages = privateMessages.get(key) || [];
    socket.emit("private:history", {
      recipientId,
      messages,
    });
    callback({ ok: true, recipientId, messages });
  });

  socket.on("private:message", (payload, callback = () => {}) => {
    const recipientId = payload?.recipientId;
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";

    if (!recipientId || recipientId === socket.user.userId) {
      callback({ ok: false, message: "Choose another user to message." });
      return;
    }

    if (!text) {
      callback({ ok: false, message: "Message cannot be empty." });
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: "private",
      senderId: socket.user.userId,
      senderName: socket.user.name,
      recipientId,
      text,
      time: new Date().toLocaleTimeString(),
    };

    const key = getDirectKey(socket.user.userId, recipientId);
    const channel = getDirectChannel(socket.user.userId, recipientId);
    const history = privateMessages.get(key) || [];
    history.push(message);
    privateMessages.set(key, history);

    io.to(channel).emit("private:message", message);

    connectedUsers.forEach((value, socketId) => {
      if (value.userId === recipientId || value.userId === socket.user.userId) {
        io.to(socketId).emit("private:preview", message);
      }
    });

    callback({ ok: true });
  });

  socket.on("disconnect", async () => {
    connectedUsers.delete(socket.id);
    await emitPresence(io);
    console.log(`User disconnected: ${profile.email}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
