import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  commandant: "Commandant",
  deputy_commandant: "Deputy Commandant",
  dc_admin: "Deputy Commissioner Admin",
  dc_academy: "Deputy Commissioner Academy",
  assistant_commissioner: "Assistant Commissioner",
  section_head: "Section Head",
  officer: "Officer",
  storekeeper: "Storekeeper",
  finance_officer: "Finance Officer",
  hr_officer: "HR Officer",
  registry_officer: "Registry Officer",
  ict_admin: "ICT Administrator",
  system_admin: "System Administrator",
};

type AuthCtx = { session: Session | null; roles: AppRole[]; loading: boolean; hasAny: (r: AppRole[]) => boolean };
const Ctx = createContext<AuthCtx>({ session: null, roles: [], loading: true, hasAny: () => false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (s: Session | null) => {
      setSession(s);
      if (s) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
        setRoles((data ?? []).map((r) => r.role));
      } else setRoles([]);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => load(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const hasAny = (r: AppRole[]) => roles.includes("system_admin") || r.some((x) => roles.includes(x));
  return <Ctx.Provider value={{ session, roles, loading, hasAny }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
