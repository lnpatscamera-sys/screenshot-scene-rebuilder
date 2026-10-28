// Corrects a wrong device clock in the browser by aligning Date with the server's time.
// The offset is cached so it applies immediately on the next load, then refreshed.
const KEY = "lnpats-clock-offset";
let offset = 0;

if (typeof window !== "undefined" && !(window as { __clockFixed?: boolean }).__clockFixed) {
  (window as { __clockFixed?: boolean }).__clockFixed = true;
  const Orig = Date;
  const realNow = Orig.now.bind(Orig);
  try { offset = Number(localStorage.getItem(KEY)) || 0; } catch { /* ignore */ }

  class FixedDate extends Orig {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [string | number | Date]));
    }
    static override now() { return realNow() + offset; }
  }
  globalThis.Date = FixedDate as DateConstructor;

  const sync = () =>
    fetch(window.location.origin + "/", { method: "HEAD", cache: "no-store" })
      .then((r) => {
        const server = Date.parse(r.headers.get("date") ?? "");
        if (Number.isNaN(server)) return;
        const diff = server - realNow();
        // Ignore tiny differences (header has 1-second precision).
        offset = Math.abs(diff) < 5000 ? 0 : diff;
        try { localStorage.setItem(KEY, String(offset)); } catch { /* ignore */ }
      })
      .catch(() => {});
  sync();
  setInterval(sync, 15 * 60 * 1000);
}

export const clockOffset = () => offset;

// Capture the recovery token from a reset link before the auth client consumes the URL.
if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
  const t = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
  if (t) try { sessionStorage.setItem("lnpats-recovery-token", t); } catch { /* ignore */ }
}
