import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { openOutlookApp } from "@/lib/official-mail";

export function useOfficialEmail() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ["official-email", uid],
    enabled: !!uid,
    queryFn: async () => {
      const r = await supabase.from("officers").select("official_email").eq("user_id", uid!).maybeSingle();
      return r.data?.official_email ?? null;
    },
  });
}

export function OfficialMailButton({ variant = "outline", className }: { variant?: "outline" | "default" | "ghost"; className?: string }) {
  const { data } = useOfficialEmail();
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => openOutlookApp(data)}
      title={data ? `Open ${data} in Outlook on this computer` : "Open Outlook on this computer"}
    >
      <Mail className="h-4 w-4" /> Official Mail
    </Button>
  );
}

export function OfficialMailNavLink() {
  const { data } = useOfficialEmail();
  return (
    <button
      type="button"
      onClick={() => openOutlookApp(data)}
      title={data ? `Open ${data} in Outlook on this computer` : "Open Outlook on this computer"}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Mail className="h-4 w-4" /> Official Mail
    </button>
  );
}
