import confetti from "canvas-confetti";

// Kept to the brand accent plus a warm gold for "money" sparkle -- a one-off
// celebration burst is the sanctioned exception to the single-accent rule.
const COLORS = ["#059669", "#10b981", "#f4b740", "#ffffff"];

/// Fires a two-sided confetti cannon plus a center burst. This is the claim
/// success moment -- the spec calls it "the demo money shot" and says to
/// over-invest here, so it gets a real celebration, not just an icon pop-in.
export function celebrateClaim() {
  const end = Date.now() + 900;

  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: COLORS });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 60,
    spread: 80,
    origin: { y: 0.5 },
    colors: COLORS,
    startVelocity: 45,
    scalar: 0.9,
  });
}
