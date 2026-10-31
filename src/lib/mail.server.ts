// Minimal IMAP/SMTP client for the cPanel-hosted @lnpats.net mailboxes (Namecheap).
import tls from "node:tls";
import PostalMime from "postal-mime";

export const MAIL_HOST = "lnpats.net";

class Conn {
  private sock: tls.TLSSocket;
  private buf = "";
  private waiters: (() => void)[] = [];
  private closed: Error | null = null;
  constructor(port: number) {
    this.sock = tls.connect({ host: MAIL_HOST, port, servername: MAIL_HOST });
    this.sock.setEncoding("latin1");
    this.sock.on("data", (d: string) => { this.buf += d; this.wake(); });
    this.sock.on("error", (e) => { this.closed = e; this.wake(); });
    this.sock.on("close", () => { this.closed ??= new Error("Mail server closed the connection"); this.wake(); });
  }
  private wake() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  write(s: string) { this.sock.write(Buffer.from(s, "latin1")); }
  async until(done: (b: string) => boolean, ms = 25000) {
    const end = Date.now() + ms;
    while (!done(this.buf)) {
      if (this.closed) throw this.closed;
      if (Date.now() > end) throw new Error("Mail server timed out");
      await new Promise<void>((r) => { this.waiters.push(r); setTimeout(r, 1000); });
    }
    const out = this.buf; this.buf = ""; return out;
  }
  end() { try { this.sock.end(); } catch { /* ignore */ } }
}

const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const latin1ToUtf8 = (s: string) => Buffer.from(s, "latin1").toString("utf8");

class Imap {
  private c = new Conn(993);
  private n = 0;
  async open(user: string, pass: string) {
    await this.c.until((b) => /\r\n$/.test(b));
    await this.cmd(`LOGIN ${q(user)} ${q(pass)}`, "Email or mailbox password is incorrect");
  }
  async cmd(line: string, failMsg?: string) {
    const tag = `L${++this.n}`;
    this.c.write(`${tag} ${line}\r\n`);
    const re = new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n$`);
    const out = await this.c.until((b) => re.test(b));
    const m = out.match(re)!;
    if (m[2] !== "OK") throw new Error(failMsg ?? "Mail server refused the request");
    return out;
  }
  async folders() {
    const out = await this.cmd(`LIST "" "*"`);
    return [...out.matchAll(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/gm)].map((m) => ({
      flags: m[1], name: m[2].trim().replace(/^"(.*)"$/, "$1"),
    }));
  }
  close() { this.cmd("LOGOUT").catch(() => {}).finally(() => this.c.end()); }
}

async function withImap<T>(user: string, pass: string, fn: (i: Imap) => Promise<T>) {
  const i = new Imap();
  try { await i.open(user, pass); return await fn(i); } finally { i.close(); }
}

async function folderFor(i: Imap, box: "inbox" | "sent") {
  if (box === "inbox") return "INBOX";
  const list = await i.folders();
  return (list.find((f) => /\\Sent/i.test(f.flags)) ?? list.find((f) => /sent/i.test(f.name)))?.name ?? "INBOX.Sent";
}

export async function verifyMailbox(user: string, pass: string) {
  await withImap(user, pass, async () => true);
}

export type MailSummary = { uid: number; from: string; fromAddress: string; to: string; subject: string; date: string | null; seen: boolean };

export async function listMessages(user: string, pass: string, box: "inbox" | "sent", limit = 40): Promise<MailSummary[]> {
  return withImap(user, pass, async (i) => {
    const folder = await folderFor(i, box);
    const sel = await i.cmd(`SELECT ${q(folder)}`, "Folder not found");
    const exists = Number(sel.match(/\* (\d+) EXISTS/)?.[1] ?? 0);
    if (!exists) return [];
    const from = Math.max(1, exists - limit + 1);
    const out = await i.cmd(`FETCH ${from}:${exists} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])`);
    const items: MailSummary[] = [];
    const re = /\* \d+ FETCH \(([^{]*)\{(\d+)\}\r\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(out))) {
      const meta = m[1];
      const header = out.substr(m.index + m[0].length, Number(m[2]));
      re.lastIndex = m.index + m[0].length + Number(m[2]);
      const uid = Number(meta.match(/UID (\d+)/)?.[1] ?? 0);
      const p = await PostalMime.parse(Buffer.from(header + "\r\n", "latin1"));
      items.push({
        uid,
        from: p.from?.name || p.from?.address || "",
        fromAddress: p.from?.address ?? "",
        to: (p.to ?? []).map((t) => t.address).filter(Boolean).join(", "),
        subject: p.subject || "(no subject)",
        date: p.date ? new Date(p.date).toISOString() : null,
        seen: /\\Seen/.test(meta),
      });
    }
    return items.reverse();
  });
}

export async function readMessage(user: string, pass: string, box: "inbox" | "sent", uid: number) {
  return withImap(user, pass, async (i) => {
    const folder = await folderFor(i, box);
    await i.cmd(`SELECT ${q(folder)}`, "Folder not found");
    const out = await i.cmd(`UID FETCH ${uid} (BODY[])`);
    const m = out.match(/\{(\d+)\}\r\n/);
    if (!m || m.index === undefined) throw new Error("Message not found");
    const raw = out.substr(m.index + m[0].length, Number(m[1]));
    const p = await PostalMime.parse(Buffer.from(raw, "latin1"));
    return {
      uid,
      from: p.from?.name ? `${p.from.name} <${p.from.address}>` : p.from?.address ?? "",
      fromAddress: p.from?.address ?? "",
      to: (p.to ?? []).map((t) => t.address).join(", "),
      cc: (p.cc ?? []).map((t) => t.address).join(", "),
      subject: p.subject || "(no subject)",
      date: p.date ? new Date(p.date).toISOString() : null,
      messageId: p.messageId ?? null,
      html: p.html ?? null,
      text: p.text ?? "",
      attachments: (p.attachments ?? []).map((a) => ({ filename: a.filename ?? "attachment", mimeType: a.mimeType, size: typeof a.content === "string" ? a.content.length : a.content.byteLength })),
    };
  });
}

const encWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

export async function sendMessage(user: string, pass: string, msg: { to: string[]; cc: string[]; subject: string; body: string; inReplyTo?: string | null }) {
  const id = `<${crypto.randomUUID()}@${MAIL_HOST}>`;
  const headers = [
    `From: ${user}`, `To: ${msg.to.join(", ")}`, ...(msg.cc.length ? [`Cc: ${msg.cc.join(", ")}`] : []),
    `Subject: ${encWord(msg.subject)}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`, `Message-ID: ${id}`,
    ...(msg.inReplyTo ? [`In-Reply-To: ${msg.inReplyTo}`, `References: ${msg.inReplyTo}`] : []),
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
  ];
  const b64 = Buffer.from(msg.body, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  const raw = `${headers.join("\r\n")}\r\n\r\n${b64}\r\n`;

  const c = new Conn(465);
  const reply = async (code: string) => {
    const out = await c.until((b) => /(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(b));
    const last = out.trim().split("\r\n").pop() ?? "";
    if (!last.startsWith(code)) throw new Error(last.startsWith("535") ? "Email or mailbox password is incorrect" : `Mail server rejected the message (${last.slice(0, 80)})`);
  };
  try {
    await reply("220");
    c.write(`EHLO erp.${MAIL_HOST}\r\n`); await reply("250");
    c.write(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64")}\r\n`); await reply("235");
    c.write(`MAIL FROM:<${user}>\r\n`); await reply("250");
    for (const r of [...msg.to, ...msg.cc]) { c.write(`RCPT TO:<${r}>\r\n`); await reply("25"); }
    c.write("DATA\r\n"); await reply("354");
    c.write(raw.replace(/\r\n\./g, "\r\n..") + ".\r\n"); await reply("250");
    c.write("QUIT\r\n");
  } finally { c.end(); }

  // Keep a copy in the Sent folder, as Outlook does.
  try {
    await withImap(user, pass, async (i) => {
      const folder = await folderFor(i, "sent");
      const bytes = Buffer.byteLength(raw, "latin1");
      await i.cmd(`APPEND ${q(folder)} (\\Seen) {${bytes}+}\r\n${raw}`);
    });
  } catch { /* sending succeeded; the Sent copy is best-effort */ }
}

// AES-GCM encryption of stored mailbox passwords.
async function key() {
  const secret = process.env["MAIL_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Mail encryption is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain));
  return `${Buffer.from(iv).toString("base64")}:${Buffer.from(ct).toString("base64")}`;
}
export async function decryptSecret(stored: string) {
  const [iv = "", ct = ""] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64") }, await key(), Buffer.from(ct, "base64"));
  return new TextDecoder().decode(pt);
}
export { latin1ToUtf8 };
