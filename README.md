Real-time Chat Application

COMPANY - CODTECH IT SOLUTIONS

NAME: UTKARSH KHANDELWAL

INTERN ID: CTIS7615

DOMAIN: FRONTEND WEB DEVELOPMENT

DURATION: 8 WEEKS

MENTOR: NEELA SANTOSH


A full-stack real-time chat application built with React, Express, Socket.IO, and MongoDB. Users can create accounts, sign in securely, join shared rooms, create new rooms, send private messages, and see live presence updates for other users.

## Features

- User signup and login with hashed passwords using `bcryptjs`
- JWT-based authentication for protected API routes and socket connections
- Public chat rooms with default rooms available on startup
- Room creation and room switching in real time
- Private one-to-one messaging between registered users
- Live online/offline presence updates
- Room member and message counters
- Persistent user accounts stored in MongoDB
- Responsive React frontend with routed auth and chat views

## Tech Stack

- Frontend: React, React Router, Socket.IO Client
- Backend: Node.js, Express, Socket.IO
- Database: MongoDB with Mongoose
- Authentication: JSON Web Tokens (`jsonwebtoken`)

## Project Structure

```text
realtime-chat/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
└── README.md
```

## How It Works

### Authentication

- New users register with name, email, and password
- Passwords are hashed before being stored
- Login returns a JWT token
- The frontend stores the token and uses it for protected API requests
- Socket.IO connections are authenticated with the same token

### Room Messaging

- Users join one shared room at a time
- The server starts with these default rooms:
  - `General`
  - `Engineering`
  - `Design`
  - `Random`
- Users can create additional rooms
- Messages are broadcast live to everyone currently in the same room

### Private Messaging

- Users can open direct conversations with other registered users
- Private message history is maintained in memory while the server is running
- Both sender and recipient receive live conversation updates

### Presence

- The app tracks connected users in real time
- Online users are shown with their current room
- Offline users still appear in the user list if they have an account

## Environment Variables

Create a `.env` file inside `backend/` based on `.env.example`.

```env
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/realtime-chat
JWT_SECRET=replace-with-a-strong-secret
```

Notes:

- `PORT` is the backend server port
- `CLIENT_URL` can be set to one or more comma-separated frontend origins
- `MONGODB_URI` points to your MongoDB instance
- `JWT_SECRET` should be replaced with a strong secret in any non-local environment

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/UTkarsh977/Real-time-chat-application.git
cd Real-time-chat-application
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 4. Start MongoDB

Make sure MongoDB is running locally or update `MONGODB_URI` to point to your database server.

## Running the App

### Start the backend

From the `backend/` directory:

```bash
node server.js
```

The backend runs on `http://localhost:5000` by default.

### Start the frontend

From the `frontend/` directory:

```bash
npm start
```

The frontend runs on `http://localhost:3000` by default.

## Available API Endpoints

### Auth

- `POST /api/auth/signup`
  - Creates a new account
- `POST /api/auth/login`
  - Logs in and returns a JWT token
- `GET /api/auth/me`
  - Returns the authenticated user profile

### Users

- `GET /api/users`
  - Returns registered users with online/offline status

## Socket Events

### Client to Server

- `rooms:create`
- `rooms:join`
- `room:message`
- `private:open`
- `private:message`

### Server to Client

- `rooms:list`
- `room:joined`
- `room:message`
- `users:list`
- `private:history`
- `private:message`
- `private:preview`



## Future Improvements

- Persist room and private messages in MongoDB
- Add message timestamps with consistent formatting
- Add typing indicators and read status
- Add profile images and richer user settings
- Improve room moderation and access control
- Add deployment configuration for production


