// Turns an email into a friendly first name for display. "ore.quadri@gmail.com" -> "Ore".
// Also used to stop the raw email leaking into the UI (we store this as senderDisplay).
export function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._+-]/)[0] ?? local;
  if (!first) return "there";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function initialFor(name: string | null | undefined): string {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}
