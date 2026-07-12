import { loginWithGoogle } from "../lib/magic";

export function Landing() {
  return (
    <main>
      <h1>Owó</h1>
      <p>Send money like a message.</p>
      <button type="button" onClick={loginWithGoogle}>
        Continue with Google
      </button>
    </main>
  );
}
