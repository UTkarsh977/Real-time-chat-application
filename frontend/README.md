# Frontend - Real-time Chat Application

This folder contains the React client for the real-time chat application.

If you are looking for full project documentation (backend, API, architecture), see the root `README.md`.

---

## What this frontend does

- Handles authentication screens (`/login`, `/signup`).
- Protects the chat route (`/chat`) for authenticated users.
- Connects to the backend with Socket.IO using JWT auth.
- Renders:
  - room conversations
  - direct/private conversations
  - online/offline user presence
  - room list updates in real time

---

## Tech used

- React
- React Router
- Socket.IO Client
- Fetch API

---

## Environment assumptions

By default, the frontend expects backend API + sockets at:

- `http://localhost:5000`

This is configured in `src/App.js` as `API_URL`.

---

## Run locally

From this `frontend/` directory:

```bash
npm install
npm start
```

The app runs on:

- `http://localhost:3000`

---

## Available scripts

- `npm start` - start development server
- `npm test` - run tests
- `npm run build` - create production build

---

## Notes for contributors

- Keep UI behavior aligned with backend Socket.IO events:
  - `rooms:list`, `users:list`, `room:joined`, `room:message`
  - `private:history`, `private:message`, `private:preview`
- Ensure auth token storage/usage remains consistent with backend JWT middleware.
- Prefer updating root `README.md` for cross-service documentation changes.
