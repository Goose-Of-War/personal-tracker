import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginSignup() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [form, setForm] = useState({ name: "", username: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ username: form.username, password: form.password });
      } else {
        await signup(form);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{mode === "login" ? "Log in" : "Create an account"}</h1>

        {mode === "signup" && (
          <label>
            Name
            <input value={form.name} onChange={update("name")} required />
          </label>
        )}

        <label>
          Username
          <input value={form.username} onChange={update("username")} required autoComplete="username" />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update("password")}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {mode === "signup" && (
          <label>
            Confirm password
            <input
              type="password"
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              required
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>

        <p className="page-hint">
          By using this app you agree to the <Link to="/legal">Privacy Policy &amp; Terms of Use</Link>.
        </p>
      </form>
    </div>
  );
}
