import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FormFields, type FormField } from "./ProcurementShared";
import { formValues } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fileRecords, type FileRecord } from "@/lib/phase2-data";
import { History } from "./Phase2Shared";
import { Download } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
export { type FormField };
export function useICTMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (run: () => Promise<void>) => run(),
    onSuccess: async () => {
      toast.success("Saved");
      await Promise.all(
        ["ict", "logistics", "notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      );
    },
    onError: (e) => toast.error(e.message),
  });
}
export function ICTForm({
  title,
  fields,
  onSave,
  onClose,
  attachments = false,
}: {
  title: string;
  fields: FormField[];
  onSave: (v: Record<string, string>, files: FileRecord[]) => Promise<void>;
  onClose: () => void;
  attachments?: boolean;
}) {
  const { session } = useAuth();
  const mutation = useICTMutation();
  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="grid sm:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const v = formValues(form);
            const input = form.elements.namedItem("files");
            const selected = input instanceof HTMLInputElement ? Array.from(input.files ?? []) : [];
            mutation.mutate(async () => {
              if (!session) throw new Error("Sign in required");
              const files = await Promise.all(
                selected.map(async (f) => {
                  const path = `${session.user.id}/${crypto.randomUUID()}/${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
                  const r = await supabase.storage.from("ict-files").upload(path, f);
                  if (r.error) throw r.error;
                  return { path, name: f.name };
                }),
              );
              await onSave(v, files);
              onClose();
            });
          }}
        >
          <FormFields fields={fields} />
          {attachments && (
            <div className="sm:col-span-2">
              <Label htmlFor="files">Documents</Label>
              <Input
                name="files"
                id="files"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              />
            </div>
          )}
          <Button type="submit" disabled={mutation.isPending} className="sm:col-span-2">
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ICTDetail({
  title,
  values,
  history,
  attachments,
  onClose,
}: {
  title: string;
  values: Record<string, unknown>;
  history?: Json;
  attachments?: Json;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          {Object.entries(values).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs capitalize text-muted-foreground">{k.replaceAll("_", " ")}</dt>
              <dd className="whitespace-pre-wrap break-words">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
        {fileRecords(attachments ?? []).map((f) => (
          <div className="flex justify-between items-center gap-3 border-b py-2" key={f.path}>
            <span className="text-sm break-all">{f.name}</span>
            <Button
              variant="outline"
              size="icon"
              title="Download document"
              aria-label={`Download ${f.name}`}
              onClick={async () => {
                const r = await supabase.storage.from("ict-files").createSignedUrl(f.path, 120);
                if (r.error) {
                  toast.error(r.error.message);
                  return;
                }
                window.open(r.data.signedUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <History value={history ?? []} />
      </DialogContent>
    </Dialog>
  );
}
