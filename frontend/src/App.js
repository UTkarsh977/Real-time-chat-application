import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState("");

  useEffect(() => {
    socket.on("history", (messages) => {
      setChat(messages);
    });

    socket.on("receive_message", (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("history");
      socket.off("receive_message");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() !== "") {
      const msgData = {
        user: username,
        text: message,
        time: new Date().toLocaleTimeString(),
      };

      socket.emit("send_message", msgData);
      setMessage("");
    }
  };

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white" }}>

      {/* Username Input */}
      {!username && (
        <div style={{ textAlign: "center", marginTop: "50px" }}>
          <input
            placeholder="Enter your name"
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: "10px" }}
          />
        </div>
      )}

      {username && (
        <>
          <h2 style={{ textAlign: "center" }}>💬 Chat App</h2>

          {/* Chat Box */}
          <div style={{
            height: "70vh",
            overflowY: "scroll",
            padding: "10px"
          }}>
            {chat.map((msg, index) => (
              <div key={index} style={{
                display: "flex",
                justifyContent:
                  msg.user === username ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  background:
                    msg.user === username ? "#6366f1" : "#1e293b",
                  padding: "10px",
                  margin: "5px",
                  borderRadius: "10px",
                  maxWidth: "60%"
                }}>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    {msg.user}
                  </div>
                  <div>{msg.text}</div>
                  <div style={{ fontSize: "10px", opacity: 0.6 }}>
                    {msg.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: "flex", padding: "10px" }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type message..."
              style={{ flex: 1, padding: "10px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;