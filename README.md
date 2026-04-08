# Real-time Chat Application

> **Updated:** April 8, 2026 — this is the expanded, detailed project documentation.

A full-stack real-time chat platform built with **React**, **Node.js**, **Express**, **Socket.IO**, and **MongoDB**.

It supports account-based authentication, room conversations, private direct messaging, and live presence updates so users can see who is online and where they are active.

---

## Features

- **Authentication**
  - User signup and login with hashed passwords (`bcryptjs`).
  - JWT-based auth for protected REST APIs and Socket.IO connections.
- **Room Chat**
  - Default rooms: `General`, `Engineering`, `Design`, `Random`.
  - Create new rooms in real time.
  - Join rooms and exchange live messages instantly.
- **Private Messaging**
  - Start direct chats between two users.
  - Conversation history is kept in server memory for active runtime.
- **Presence & Collaboration**
  - Live online/offline user status.
  - Current room tracking.
  - Dynamic room list with member/message counts.
- **Client Experience**
  - Route-based auth flow (`/login`, `/signup`, `/chat`).
  - Protected chat route for authenticated users.
  - Real-time UI updates for room, private, and presence events.

---

## Tech Stack

### Frontend
- React
- React Router
- Socket.IO Client
- Fetch API

### Backend
- Node.js
- Express
- Socket.IO
- Mongoose
- MongoDB
- JWT (`jsonwebtoken`)
- `bcryptjs`
- `cors`, `dotenv`

---

## Project Structure

```text
Real-time-chat-application/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── package-lock.json
└── README.md
```

---

## How It Works

1. A user signs up or logs in through REST endpoints.
2. The backend returns a JWT token after successful login.
3. The frontend stores the token and uses it for:
   - protected HTTP requests (e.g., `/api/users`, `/api/auth/me`)
   - authenticated Socket.IO handshake
4. On socket connection, the server:
   - registers the user as online
   - joins them to a default room
   - emits room list, room history, and presence updates
5. Users can then:
   - join/create rooms
   - send room messages
   - open private chats and send direct messages

---

## Backend API

Base URL (local): `http://localhost:5000`

### Health
- `GET /`
  - Returns backend status message.

### Auth
- `POST /api/auth/signup`
  - Body: `{ name, email, password }`
  - Creates a new user (password min length: 6).
- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Returns `{ token, user }` on success.
- `GET /api/auth/me`
  - Requires `Authorization: Bearer <token>`.
  - Returns current authenticated user profile.

### Users
- `GET /api/users`
  - Requires `Authorization: Bearer <token>`.
  - Returns all users except requester, with `online/offline` status.

---

## Socket.IO Events

### Client → Server
- `rooms:create` (roomName)
- `rooms:join` (roomName)
- `room:message` ({ room, text })
- `private:open` ({ recipientId })
- `private:message` ({ recipientId, text })

### Server → Client
- `rooms:list`
- `users:list`
- `room:joined`
- `room:message`
- `private:history`
- `private:message`
- `private:preview`

---

## Environment Variables

Create a `.env` file inside `backend/`:

```env
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/realtime-chat
JWT_SECRET=change-me-in-production
```

---

## Getting Started (Local Development)

### Prerequisites
- Node.js (LTS recommended)
- npm
- MongoDB running locally (or accessible remote URI)

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Start backend server

```bash
cd backend
node server.js
```

Backend runs on `http://localhost:5000`.

### 3) Start frontend app

```bash
cd frontend
npm start
```

Frontend runs on `http://localhost:3000`.

---

## Security Notes

- Do **not** use the default JWT secret in production.
- Use HTTPS and secure cookie/token handling in production deployments.
- Add request rate limiting and stronger validation for production hardening.

---

## Current Limitations

- Message history is kept in memory (`Map`) and resets on server restart.
- Room and direct messages are not persisted in MongoDB yet.
- No media/file attachments.
- No typing indicators/read receipts.

---

## Future Enhancements

- Persist chat messages in MongoDB.
- Add message pagination and search.
- Add typing indicators, read receipts, and notifications.
- Add profile photos and user settings.
- Dockerize frontend/backend and add CI/CD pipeline.

---

## License

This project is currently unlicensed. Add a `LICENSE` file to define usage terms.
