import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Inbox, Send, PenSquare, Reply, Forward, RefreshCw, LogOut, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMailAccount, connectMailbox, disconnectMailbox, listMail, readMail, sendMail } from "@/lib/mail.functions";
import { liberiaDateTime as formatDateTime } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/mail")({
  head: () => ({ meta: [
    { title: "Official Mail — LNPATS ERP" },
    { name: "description", content: "Read and reply to your @lnpats.net email inside the ERP." },
    { property: "og:title", content: "Official Mail — LNPATS ERP" },
    { property: "og:description", content: "Your official LNPATS inbox inside the ERP." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MailPage,
});

type Box = "inbox" | "sent";
type Draft = { to: string; cc: string; subject: string; body: string; inReplyTo?: string | null };
const splitAddr = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

function MailPage() {
  const acct = useQuery({ queryKey: ["mail-account"], queryFn: useServerFn(getMailAccount) });
  if (acct.isLoading) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (!acct.data?.email) return <ConnectCard />;
  return <Mailbox email={acct.data.email} />;
}

function ConnectCard() {
  const qc = useQueryClient();
  const connect = useServerFn(connectMailbox);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => connect({ data: { email, password } }),
    onSuccess: () => { toast.success("Mailbox connected"); qc.invalidateQueries({ queryKey: ["mail-account"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-md p-6">
      <Card className="p-6 space-y-4">
        <div><h1 className="text-xl font-semibold">Connect your official mailbox</h1>
          <p className="text-sm text-muted-foreground">Enter your @lnpats.net address and its mailbox password once. It is stored encrypted and only you can use it.</p></div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Input type="email" placeholder="name@lnpats.net" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Mailbox password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={m.isPending}>{m.isPending ? "Checking…" : "Connect mailbox"}</Button>
        </form>
      </Card>
    </div>
  );
}

function Mailbox({ email }: { email: string }) {
  const qc = useQueryClient();
  const [box, setBox] = useState<Box>("inbox");
  const [uid, setUid] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const list = useQuery({ queryKey: ["mail", box], queryFn: () => listFn({ data: { box } }), retry: false });
  const listFn = useServerFn(listMail); const readFn = useServerFn(readMail); const disc = useServerFn(disconnectMailbox);
  const msg = useQuery({ queryKey: ["mail-msg", box, uid], queryFn: () => readFn({ data: { box, uid: uid! } }), enabled: !!uid, retry: false });

  const reply = (fwd: boolean) => {
    const d = msg.data; if (!d) return;
    const quoted = `\n\n---- On ${d.date ? formatDateTime(d.date) : ""}, ${d.from} wrote:\n${d.text.split("\n").map((l) => "> " + l).join("\n")}`;
    setDraft(fwd ? { to: "", cc: "", subject: `Fwd: ${d.subject}`, body: quoted }
      : { to: d.fromAddress, cc: "", subject: /^re:/i.test(d.subject) ? d.subject : `Re: ${d.subject}`, body: quoted, inReplyTo: d.messageId });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold mr-auto">Official Mail <span className="text-sm font-normal text-muted-foreground">{email}</span></h1>
        <Button onClick={() => setDraft({ to: "", cc: "", subject: "", body: "" })}><PenSquare className="h-4 w-4" /> New email</Button>
        <Button variant="outline" size="icon" title="Refresh" onClick={() => list.refetch()}><RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} /></Button>
        <Button variant="ghost" size="icon" title="Disconnect mailbox" onClick={async () => { await disc(); qc.invalidateQueries({ queryKey: ["mail-account"] }); }}><LogOut className="h-4 w-4" /></Button>
      </div>
      <div className="flex gap-2">
        {(["inbox", "sent"] as Box[]).map((b) => (
          <Button key={b} variant={box === b ? "default" : "outline"} size="sm" onClick={() => { setBox(b); setUid(null); }}>
            {b === "inbox" ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />} {b === "inbox" ? "Inbox" : "Sent"}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className={`divide-y overflow-hidden ${uid ? "hidden lg:block" : ""}`}>
          {list.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading messages…</p>}
          {list.error && <p className="p-4 text-sm text-destructive">{(list.error as Error).message}</p>}
          {list.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No messages.</p>}
          {list.data?.map((m) => (
            <button key={m.uid} onClick={() => setUid(m.uid)} className={`block w-full text-left p-3 hover:bg-muted ${uid === m.uid ? "bg-muted" : ""}`}>
              <div className="flex justify-between gap-2 text-sm">
                <span className={`truncate ${m.seen ? "" : "font-semibold"}`}>{box === "sent" ? `To: ${m.to}` : m.from}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.date ? formatDateTime(m.date) : ""}</span>
              </div>
              <div className={`truncate text-sm ${m.seen ? "text-muted-foreground" : "font-medium"}`}>{m.subject}</div>
            </button>
          ))}
        </Card>
        <Card className={`p-4 min-h-[300px] ${uid ? "" : "hidden lg:block"}`}>
          {!uid && <p className="text-sm text-muted-foreground">Select a message to read it.</p>}
          {uid && msg.isLoading && <p className="text-sm text-muted-foreground">Opening…</p>}
          {msg.error && <p className="text-sm text-destructive">{(msg.error as Error).message}</p>}
          {msg.data && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setUid(null)}>← Back</Button>
              <h2 className="text-lg font-semibold">{msg.data.subject}</h2>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <div><b>From:</b> {msg.data.from}</div><div><b>To:</b> {msg.data.to}</div>
                {msg.data.cc && <div><b>Cc:</b> {msg.data.cc}</div>}
                {msg.data.date && <div>{formatDateTime(msg.data.date)}</div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => reply(false)}><Reply className="h-4 w-4" /> Reply</Button>
                <Button size="sm" variant="outline" onClick={() => reply(true)}><Forward className="h-4 w-4" /> Forward</Button>
              </div>
              {msg.data.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">{msg.data.attachments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded border px-2 py-1"><Paperclip className="h-3 w-3" />{a.filename}</span>))}</div>
              )}
              {msg.data.html
                ? <iframe title="Message" sandbox="" className="w-full h-[60vh] rounded border bg-card"
                    srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">${msg.data.html}`} />
                : <pre className="whitespace-pre-wrap text-sm font-sans">{msg.data.text}</pre>}
            </div>
          )}
        </Card>
      </div>
      {draft && <Compose draft={draft} onClose={() => setDraft(null)} onSent={() => { setDraft(null); qc.invalidateQueries({ queryKey: ["mail", "sent"] }); }} />}
    </div>
  );
}

function Compose({ draft, onClose, onSent }: { draft: Draft; onClose: () => void; onSent: () => void }) {
  const [d, setD] = useState(draft);
  const send = useServerFn(sendMail);
  const m = useMutation({
    mutationFn: () => send({ data: { to: splitAddr(d.to), cc: splitAddr(d.cc), subject: d.subject, body: d.body, inReplyTo: d.inReplyTo } }),
    onSuccess: () => { toast.success("Email sent"); onSent(); },
    onError: (e: Error) => toast.error(e.message.includes("Invalid email") ? "Check the recipient addresses" : e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{d.inReplyTo ? "Reply" : "New email"}</DialogTitle></DialogHeader>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Input placeholder="To (separate with commas)" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} required />
          <Input placeholder="Cc" value={d.cc} onChange={(e) => setD({ ...d, cc: e.target.value })} />
          <Input placeholder="Subject" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          <Textarea rows={12} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}><Send className="h-4 w-4" /> {m.isPending ? "Sending…" : "Send"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
