import { initialFor } from "../lib/identity";

// A warm initial chip. No photo (we never fetch one), just the first letter on a
// soft accent tint, which is enough to establish "who" without any crypto identity.
export function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initialFor(name)}
    </div>
  );
}
