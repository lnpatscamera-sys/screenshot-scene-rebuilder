import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatusBadge } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/officers/$id")({
  head: () => ({ meta: [{ title: "Officer Profile — LNPATS ERP" }] }),
  component: OfficerPage,
});

const LONG_FIELDS = [
  ["education", "Educational background"], ["training_history", "Training history"], ["promotion_history", "Promotion history"],
  ["commendations", "Commendations"], ["disciplinary_actions", "Disciplinary actions"], ["medical_info", "Medical information"],
  ["next_of_kin", "Next of kin"], ["emergency_contact", "Emergency contact"], ["address", "Address"],
] as const;

function OfficerPage() {
  const { id } = Route.useParams();
  const { hasAny } = useAuth();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const { data: o } = useQuery({
    queryKey: ["officer", id],
    queryFn: async () => (await supabase.from("officers").select("*, sections(name), offices(name)").eq("id", id).single()).data,
  });
  if (!o) return <p className="text-muted-foreground">Loading…</p>;
  const canEdit = hasAny(["hr_officer", "commandant"]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase.from("officers").update({ ...f, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setEdit(false);
    qc.invalidateQueries({ queryKey: ["officer", id] });
  };

  const uploadPhoto = async (file: File) => {
    const path = `${id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("officer-files").upload(path, file);
    if (up.error) return toast.error(up.error.message);
    const { data } = supabase.storage.from("officer-files").getPublicUrl(path);
    await supabase.from("officers").update({ photo_url: data.publicUrl }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["officer", id] });
  };

  return (
    <div>
      <div className="no-print mb-2"><Link to="/officers" className="text-sm text-muted-foreground hover:underline">← All officers</Link></div>
      <PageHeader
        title={`${o.rank} ${o.full_name}`}
        subtitle={`${o.service_number} · ${o.position ?? ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>Print ID card</Button>
            {canEdit && <Button onClick={() => setEdit(!edit)}>{edit ? "Cancel" : "Edit profile"}</Button>}
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          {/* ID card */}
          <div className="mx-auto w-[340px] rounded-xl overflow-hidden shadow-lg border bg-card">
            <div className="bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center gap-3">
              <Logo className="h-12 w-12" />
              <div className="leading-tight">
                <div className="text-[10px] tracking-widest text-sidebar-primary">REPUBLIC OF LIBERIA</div>
                <div className="text-xs font-bold">LIBERIA NATIONAL POLICE ACADEMY & TRAINING SCHOOL</div>
              </div>
            </div>
            <div className="stripe-band" />
            <div className="p-4 flex gap-4">
              <div className="h-28 w-24 bg-muted rounded-md overflow-hidden grid place-items-center text-xs text-muted-foreground">
                {o.photo_url ? <img src={o.photo_url} alt={o.full_name} className="h-full w-full object-cover" /> : "Photo"}
              </div>
              <div className="text-xs space-y-1 flex-1">
                <div className="font-bold text-sm">{o.full_name}</div>
                <div><span className="text-muted-foreground">Rank:</span> {o.rank}</div>
                <div><span className="text-muted-foreground">Service #:</span> {o.service_number}</div>
                <div><span className="text-muted-foreground">Section:</span> {o.sections?.name ?? "—"}</div>
                <div><span className="text-muted-foreground">Position:</span> {o.position ?? "—"}</div>
              </div>
            </div>
            <div className="px-4 pb-4 flex items-end justify-between">
              <div className="text-[10px] text-muted-foreground">If found, return to LNPATS, Paynesville, Liberia</div>
              <QRCodeSVG value={`LNPATS:${o.service_number}`} size={56} />
            </div>
          </div>
          {canEdit && (
            <div className="no-print text-center">
              <Label className="text-xs text-muted-foreground">Upload photo</Label>
              <Input type="file" accept="image/*" className="mt-1" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </div>
          )}
        </div>

        <Card className="lg:col-span-2 no-print">
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent>
            {edit ? (
              <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
                {(["full_name", "rank", "phone", "email", "county", "nationality", "marital_status", "position", "current_assignment", "employment_status"] as const).map((k) => (
                  <div key={k} className="space-y-1"><Label className="capitalize">{k.replace("_", " ")}</Label><Input name={k} defaultValue={o[k] ?? ""} /></div>
                ))}
                {LONG_FIELDS.map(([k, l]) => (
                  <div key={k} className="space-y-1 sm:col-span-2"><Label>{l}</Label><Textarea name={k} defaultValue={o[k] ?? ""} rows={2} /></div>
                ))}
                <Button className="sm:col-span-2">Save changes</Button>
              </form>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row l="Status" v={<StatusBadge value={o.employment_status} />} />
                <Row l="Date of birth" v={o.date_of_birth} />
                <Row l="Gender" v={o.gender} />
                <Row l="Marital status" v={o.marital_status} />
                <Row l="Nationality" v={o.nationality} />
                <Row l="County" v={o.county} />
                <Row l="Phone" v={o.phone} />
                <Row l="Email" v={o.email} />
                <Row l="Date joined LNP" v={o.date_joined} />
                <Row l="Office" v={o.offices?.name} />
                <Row l="Section" v={o.sections?.name} />
                <Row l="Current assignment" v={o.current_assignment} />
                {LONG_FIELDS.map(([k, l]) => <Row key={k} l={l} v={o[k]} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ l, v }: { l: string; v: React.ReactNode }) {
  return <div><div className="text-xs text-muted-foreground">{l}</div><div>{v || "—"}</div></div>;
}
