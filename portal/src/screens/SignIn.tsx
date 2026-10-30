import { useState, type FormEvent } from "react";
import { useSession } from "../providers/session.tsx";

export function SignIn() {
  const session = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await session.signIn(username.trim(), password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1>Receipt review</h1>
      <p>Sign in with the same company user as the phone.</p>
      <form onSubmit={onSubmit}>
        <label>
          Username
          <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
