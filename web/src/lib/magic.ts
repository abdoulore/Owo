import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";

const MAGIC_PUBLISHABLE_KEY = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY as string;

export const magic = new Magic(MAGIC_PUBLISHABLE_KEY, {
  extensions: [new OAuthExtension()],
});

export async function loginWithGoogle() {
  await magic.oauth2.loginWithRedirect({
    provider: "google",
    redirectURI: `${window.location.origin}/auth/callback`,
  });
}

/// Completes the OAuth flow on /auth/callback. Returns the user's provisioned
/// address so the caller can route onward; the address is never shown in the UI.
export async function completeGoogleLogin(): Promise<string | null> {
  await magic.oauth2.getRedirectResult();
  return getUserAddress();
}

/// Magic's own EOA (the smart account's owner/validator key) — NOT the address
/// that appears on-chain as msg.sender. For that, use getSmartAccountAddress()
/// in lib/zerodev.ts; links, claims, and history all key off the smart account.
export async function getUserAddress(): Promise<string | null> {
  const isLoggedIn = await magic.user.isLoggedIn();
  if (!isLoggedIn) return null;
  const info = await magic.user.getInfo();
  return info.wallets.ethereum?.publicAddress ?? null;
}

export async function getUserEmail(): Promise<string | null> {
  const isLoggedIn = await magic.user.isLoggedIn();
  if (!isLoggedIn) return null;
  const info = await magic.user.getInfo();
  return info.email;
}
