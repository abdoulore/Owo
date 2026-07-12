import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";

const MAGIC_PUBLISHABLE_KEY = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY as string;

export const magic = new Magic(MAGIC_PUBLISHABLE_KEY, {
  extensions: [new OAuthExtension()],
});

export async function loginWithGoogle() {
  // TODO(Phase 0 spike): confirm OAuth redirect flow works end-to-end,
  // log the resulting wallet address (never shown to the user in the UI).
  await magic.oauth2.loginWithRedirect({
    provider: "google",
    redirectURI: `${window.location.origin}/auth/callback`,
  });
}

export async function getUserAddress(): Promise<string | null> {
  const isLoggedIn = await magic.user.isLoggedIn();
  if (!isLoggedIn) return null;
  const info = await magic.user.getInfo();
  return info.wallets.ethereum?.publicAddress ?? null;
}
