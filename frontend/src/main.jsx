import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogOut, MessageSquareText, Send, Sparkles, UserRound } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await request(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      onAuthenticated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="Authentication">
        <div className="brand-row">
          <span className="brand-mark">
            <Sparkles size={22} aria-hidden="true" />
          </span>
          <div>
            <h1>LLM Chat</h1>
            <p>Sign in before starting a conversation.</p>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
            Register
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required />
          </label>

          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={3}
              required
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" disabled={loading} type="submit">
            <UserRound size={18} aria-hidden="true" />
            {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <article className={`message ${isUser ? "user-message" : "assistant-message"}`}>
      <div className="message-meta">{isUser ? "You" : "Assistant"}</div>
      <p>{message.content}</p>
    </article>
  );
}

function ChatView({ session, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const initials = useMemo(() => session.user.username.slice(0, 2).toUpperCase(), [session.user.username]);

  useEffect(() => {
    request("/messages", {
      headers: authHeaders(session.token)
    })
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message));
  }, [session.token]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || loading) {
      return;
    }

    setDraft("");
    setError("");
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content }]);

    try {
      const data = await request("/chat", {
        method: "POST",
        headers: authHeaders(session.token),
        body: JSON.stringify({ message: content })
      });

      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
        headers: authHeaders(session.token)
      });
    } finally {
      onLogout();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row compact">
          <span className="brand-mark">
            <MessageSquareText size={22} aria-hidden="true" />
          </span>
          <div>
            <h1>LLM Chat</h1>
            <p>Express + Postgres</p>
          </div>
        </div>

        <div className="account-block">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{session.user.username}</strong>
            <span>Logged in</span>
          </div>
        </div>

        <button className="secondary-button" onClick={logout} type="button">
          <LogOut size={18} aria-hidden="true" />
          Logout
        </button>
      </aside>

      <section className="chat-panel" aria-label="Chat">
        <header className="chat-header">
          <div>
            <h2>Conversation</h2>
            <p>Messages are saved for your account.</p>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={28} aria-hidden="true" />
              <p>Ask the assistant something to begin.</p>
            </div>
          ) : (
            messages.map((message, index) => <ChatMessage key={`${message.role}-${index}`} message={message} />)
          )}

          {loading ? (
            <article className="message assistant-message pending">
              <div className="message-meta">Assistant</div>
              <p>Thinking...</p>
            </article>
          ) : null}

          <div ref={scrollRef} />
        </div>

        {error ? <p className="chat-error">{error}</p> : null}

        <form className="composer" onSubmit={sendMessage}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(event);
              }
            }}
            placeholder="Type a message"
            rows={2}
          />
          <button className="send-button" disabled={loading || draft.trim().length === 0} aria-label="Send" type="submit">
            <Send size={20} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("llm-chat-session");
    return saved ? JSON.parse(saved) : null;
  });

  function handleAuthenticated(data) {
    localStorage.setItem("llm-chat-session", JSON.stringify(data));
    setSession(data);
  }

  function handleLogout() {
    localStorage.removeItem("llm-chat-session");
    setSession(null);
  }

  return session ? (
    <ChatView session={session} onLogout={handleLogout} />
  ) : (
    <AuthView onAuthenticated={handleAuthenticated} />
  );
}

createRoot(document.getElementById("root")).render(<App />);
