import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
export { outlookUrl } from "@/lib/official-mail";
import { outlookUrl } from "@/lib/official-mail";

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
    <Button asChild variant={variant} className={className}>
      <a href={outlookUrl(data)} target="_blank" rel="noopener noreferrer" title={data ? `Open ${data} in classic Outlook` : "Open classic Outlook"}>
        <Mail className="h-4 w-4" /> Official Mail (classic Outlook)
      </a>
    </Button>
  );
}

export function OfficialMailNavLink() {
  const { data } = useOfficialEmail();
  return (
    <a href={outlookUrl(data)} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <Mail className="h-4 w-4" /> Official Mail (Outlook classic)
    </a>
  );
}
