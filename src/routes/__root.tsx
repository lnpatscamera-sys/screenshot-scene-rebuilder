import "@/lib/server-clock";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useCallback, useEffect, type ReactNode } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { canOpenOfficerPath, OFFICER_PATHS } from '@/lib/officer-access';
import { AppShell } from '@/components/AppShell';
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  if(error instanceof Error && error.message==='Access Denied') return <div className="min-h-screen bg-background p-8" role="alert"><h1 className="text-2xl font-semibold">Access Denied</h1><p className="mt-3 text-muted-foreground">Your account is not authorized to access this page.</p><Link to="/dashboard" className="inline-block mt-5 text-primary">Dashboard</Link></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({location}) => {
    const path=location.pathname.replace(/\/$/,'') || '/';
    if(['/','/auth','/reset-password'].includes(path) || path.startsWith('/api/') || path.startsWith('/lovable/') || OFFICER_PATHS.some(p=>p===path)) return;
    const {data}=await supabase.auth.getSession();
    if(!data.session) return;
    const result=await supabase.from('user_roles').select('role').eq('user_id',data.session.user.id);
    if(result.error || !canOpenOfficerPath((result.data??[]).map(r=>r.role),path)) throw new Error('Access Denied');
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LNPATS ERP" },
      { name: "description", content: "Enterprise Resource Planning for the Liberia National Police Academy and Training School." },
      { property: "og:title", content: "LNPATS ERP" },
      { property: "og:description", content: "Enterprise Resource Planning for the Liberia National Police Academy and Training School." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const onIdentityChange = useCallback((event: AuthChangeEvent) => {
    router.invalidate();
    if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider onIdentityChange={onIdentityChange}>
        <AuthorizedOutlet />
        <Toaster richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthorizedOutlet() {
  const {roles,loading,session}=useAuth();
  const path=useRouterState({select:s=>s.location.pathname});
  const protectedPath=!['/','/auth','/reset-password'].includes(path)&&!path.startsWith('/api/')&&!path.startsWith('/lovable/');
  if(protectedPath&&session&&!loading&&!canOpenOfficerPath(roles,path)) return <AppShell/>;
  return <Outlet/>;
}
