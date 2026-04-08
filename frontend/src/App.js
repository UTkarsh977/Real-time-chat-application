import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { io } from "socket.io-client";
import "./App.css";

function getApiUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }

  return "http://localhost:5000";
}

const API_URL = getApiUrl();
const TOKEN_KEY = "chat_token";

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function ProtectedRoute({ isAuthenticated, isLoading, children }) {
  if (isLoading) {
    return <div className="screen-center">Checking your session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AuthRoute({ isAuthenticated, children }) {
  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

function AuthPage({ mode, onSubmit, isSubmitting }) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await onSubmit({ name, email, password });

      if (isSignup) {
        navigate("/login");
      }
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="brand-pill">Realtime Chat</div>
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-copy">
          {isSignup
            ? "Join rooms, message teammates directly, and track who is online in real time."
            : "Sign in to jump back into your rooms and private chats."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Doe"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Please wait..."
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already registered?" : "Need an account?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>

      <div className="auth-hero">
        <div className="hero-card">
          <span className="hero-kicker">Presence aware</span>
          <h2>Rooms, direct messaging, and live online status in one place.</h2>
          <p>
            The sidebar keeps the room list and user presence current so you can
            see who is active before you switch conversations.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatPage({ token, user, onLogout }) {
  const socket = useMemo(
    () =>
      io(API_URL, {
        autoConnect: false,
        auth: { token },
      }),
    [token]
  );

  const [status, setStatus] = useState("Connecting...");
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [roomMessages, setRoomMessages] = useState({});
  const [privateMessages, setPrivateMessages] = useState({});
  const [activeView, setActiveView] = useState({ type: "room", id: "General" });
  const [draftMessage, setDraftMessage] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await apiRequest("/api/users", {
          method: "GET",
          token,
        });

        setUsers(data.users);
      } catch (error) {
        setNotice(error.message);
      }
    }

    loadUsers();
  }, [token]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      setStatus("Connected");
    });

    socket.on("connect_error", (error) => {
      setStatus(error.message || "Unable to connect");
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
    });

    socket.on("rooms:list", (nextRooms) => {
      setRooms(nextRooms);
    });

    socket.on("users:list", (nextUsers) => {
      setUsers(nextUsers);
    });

    socket.on("room:joined", ({ room, messages }) => {
      setActiveView({ type: "room", id: room });
      setRoomMessages((previous) => ({
        ...previous,
        [room]: messages,
      }));
    });

    socket.on("room:message", (message) => {
      setRoomMessages((previous) => ({
        ...previous,
        [message.room]: [...(previous[message.room] || []), message],
      }));
    });

    socket.on("private:history", ({ recipientId, messages }) => {
      setActiveView({ type: "private", id: recipientId });
      setPrivateMessages((previous) => ({
        ...previous,
        [recipientId]: messages,
      }));
    });

    socket.on("private:message", (message) => {
      const otherUserId =
        message.senderId === user.id ? message.recipientId : message.senderId;

      setPrivateMessages((previous) => ({
        ...previous,
        [otherUserId]: [...(previous[otherUserId] || []), message],
      }));
    });

    socket.on("private:preview", (message) => {
      const otherUserId =
        message.senderId === user.id ? message.recipientId : message.senderId;

      setPrivateMessages((previous) => {
        const currentMessages = previous[otherUserId] || [];
        const alreadyTracked = currentMessages.some((item) => item.id === message.id);

        if (alreadyTracked) {
          return previous;
        }

        return {
          ...previous,
          [otherUserId]: [...currentMessages, message],
        };
      });
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("rooms:list");
      socket.off("users:list");
      socket.off("room:joined");
      socket.off("room:message");
      socket.off("private:history");
      socket.off("private:message");
      socket.off("private:preview");
      socket.disconnect();
    };
  }, [socket, user.id]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  function joinRoom(roomName) {
    setDraftMessage("");
    socket.emit("rooms:join", roomName, (result) => {
      if (!result?.ok) {
        setNotice(result?.message || "Could not join room.");
      }
    });
  }

  function openPrivateChat(recipientId) {
    setDraftMessage("");
    socket.emit("private:open", { recipientId }, (result) => {
      if (!result?.ok) {
        setNotice(result?.message || "Could not open private chat.");
      }
    });
  }

  function createRoom(event) {
    event.preventDefault();

    if (!newRoomName.trim()) {
      setNotice("Room name is required.");
      return;
    }

    socket.emit("rooms:create", newRoomName, (result) => {
      if (!result?.ok) {
        setNotice(result?.message || "Could not create room.");
        return;
      }

      setNotice(`Joined #${result.room}`);
      setNewRoomName("");
    });
  }

  function sendMessage(event) {
    event.preventDefault();

    if (!draftMessage.trim()) {
      setNotice("Message cannot be empty.");
      return;
    }

    const nextMessage = draftMessage;

    if (activeView.type === "room") {
      socket.emit(
        "room:message",
        {
          room: activeView.id,
          text: nextMessage,
        },
        (result) => {
          if (!result?.ok) {
            setNotice(result?.message || "Could not send room message.");
            return;
          }

          setDraftMessage("");
        }
      );

      return;
    }

    socket.emit(
      "private:message",
      {
        recipientId: activeView.id,
        text: nextMessage,
      },
      (result) => {
        if (!result?.ok) {
          setNotice(result?.message || "Could not send private message.");
          return;
        }

        setDraftMessage("");
      }
    );
  }

  const activeRoom = rooms.find((room) => room.name === activeView.id);
  const activeRecipient = users.find((item) => item.userId === activeView.id);
  const onlineUsers = users.filter((item) => item.status === "online");
  const offlineUsers = users.filter((item) => item.status === "offline");
  const messages =
    activeView.type === "room"
      ? roomMessages[activeView.id] || []
      : privateMessages[activeView.id] || [];

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar">
        <div>
          <div className="brand-pill">Authenticated</div>
          <h1>Realtime Chat</h1>
          <p className="sidebar-copy">
            Signed in as <strong>{user.name}</strong>
          </p>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
          </div>
        </div>

        <div className="status-chip">{status}</div>

        <section className="sidebar-section">
          <div className="section-heading">
            <h3>Rooms</h3>
            <span>{rooms.length}</span>
          </div>

          <form className="new-room-form" onSubmit={createRoom}>
            <input
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              placeholder="Create room"
            />
            <button className="secondary-button compact-button" type="submit">
              Add
            </button>
          </form>

          <div className="sidebar-list">
            {rooms.map((room) => (
              <button
                key={room.name}
                className={`sidebar-item ${
                  activeView.type === "room" && activeView.id === room.name ? "active" : ""
                }`}
                onClick={() => joinRoom(room.name)}
                type="button"
              >
                <div>
                  <strong># {room.name}</strong>
                  <span>{room.messages} messages</span>
                </div>
                <span>{room.members}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="section-heading">
            <h3>Online</h3>
            <span>{onlineUsers.length}</span>
          </div>

          <div className="sidebar-list">
            {onlineUsers.length === 0 ? (
              <div className="sidebar-empty">No one else is online right now.</div>
            ) : (
              onlineUsers.map((participant) => {
                const previews = privateMessages[participant.userId] || [];
                const latest = previews[previews.length - 1];

                return (
                  <button
                    key={participant.userId}
                    className={`sidebar-item ${
                      activeView.type === "private" && activeView.id === participant.userId
                        ? "active"
                        : ""
                    }`}
                    onClick={() => openPrivateChat(participant.userId)}
                    type="button"
                  >
                    <div>
                      <strong>{participant.name}</strong>
                      <span>{latest ? latest.text : participant.email}</span>
                    </div>
                    <span className="presence-indicator online">
                      <span className="presence-dot" />
                      online
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="section-heading">
            <h3>Offline</h3>
            <span>{offlineUsers.length}</span>
          </div>

          <div className="sidebar-list">
            {offlineUsers.length === 0 ? (
              <div className="sidebar-empty">Everyone is online.</div>
            ) : (
              offlineUsers.map((participant) => (
                <div key={participant.userId} className="sidebar-item offline-item">
                  <div>
                    <strong>{participant.name}</strong>
                    <span>{participant.email}</span>
                  </div>
                  <span className="presence-indicator offline">
                    <span className="presence-dot" />
                    offline
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <button className="secondary-button" onClick={onLogout}>
          Log out
        </button>
      </aside>

      <main className="chat-panel">
        <div className="chat-header">
          <div>
            <h2>
              {activeView.type === "room"
                ? `# ${activeView.id}`
                : activeRecipient
                  ? activeRecipient.name
                  : "Private chat"}
            </h2>
            <p>
              {activeView.type === "room"
                ? `${activeRoom?.members || 0} people currently in this room. Messages stay inside the room.`
                : activeRecipient?.status === "online"
                  ? "This user is online now. Direct messages appear only in this conversation."
                  : "This user is offline. You can reopen this chat when they come back online."}
            </p>
          </div>

          {notice && <div className="notice-chip">{notice}</div>}
        </div>

        <div className="messages-list">
          {messages.length === 0 ? (
            <div className="empty-state">
              {activeView.type === "room"
                ? "No room messages yet. Say hello to everyone here."
                : "No private messages yet. Start the conversation."}
            </div>
          ) : (
            messages.map((item) => {
              const isOwnMessage = item.senderId === user.id;

              return (
                <div
                  key={item.id}
                  className={`message-row ${isOwnMessage ? "own-message" : ""}`}
                >
                  <div className="message-bubble">
                    <div className="message-meta">
                      <span>{isOwnMessage ? "You" : item.senderName}</span>
                      <span>{item.time}</span>
                    </div>
                    <p>{item.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={
              activeView.type === "room"
                ? `Message #${activeView.id}`
                : `Message ${activeRecipient?.name || "user"}`
            }
          />
          <button className="primary-button" type="submit">
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(getStoredToken()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadCurrentUser() {
      const storedToken = getStoredToken();

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/api/auth/me", {
          method: "GET",
          token: storedToken,
        });

        setToken(storedToken);
        setUser(data.user);
      } catch (_error) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  async function handleSignup(formData) {
    setIsSubmitting(true);

    try {
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(formData),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin(formData) {
    setIsSubmitting(true);

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      navigate("/chat");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  const isAuthenticated = Boolean(token && user);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthRoute isAuthenticated={isAuthenticated}>
            <AuthPage
              mode="login"
              onSubmit={handleLogin}
              isSubmitting={isSubmitting}
            />
          </AuthRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthRoute isAuthenticated={isAuthenticated}>
            <AuthPage
              mode="signup"
              onSubmit={handleSignup}
              isSubmitting={isSubmitting}
            />
          </AuthRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
          >
            <ChatPage token={token} user={user} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
