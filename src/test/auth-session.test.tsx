import { act, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  listener: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined,
  roles: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { onAuthStateChange: vi.fn((listener) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  }) },
  from: () => ({ select: () => ({ eq: mocks.roles }) }),
} }));

const session = { user: { id: "staff-1" } } as Session;
function State() {
  const { session, roles } = useAuth();
  return <output>{session?.user.id ?? "signed-out"}:{roles.join(",")}</output>;
}
async function emit(event: AuthChangeEvent, value: Session | null) {
  await act(async () => {
    mocks.listener?.(event, value);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
beforeEach(() => { vi.clearAllMocks(); mocks.roles.mockResolvedValue({ data: [{ role: "officer" }], error: null }); });
afterEach(cleanup);

describe("Auth session transitions", () => {
  it("does not revalidate routes or reload roles for repeated sign-in and refresh events", async () => {
    const changed = vi.fn();
    render(<AuthProvider onIdentityChange={changed}><State /></AuthProvider>);
    await emit("INITIAL_SESSION", null);
    await emit("SIGNED_IN", session);
    for (let i = 0; i < 12; i++) await emit("SIGNED_IN", session);
    await emit("TOKEN_REFRESHED", session);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith("SIGNED_IN");
    expect(mocks.roles).toHaveBeenCalledTimes(1);
  });

  it("clears roles on sign-out even when an old role request finishes later", async () => {
    let finish: ((value: unknown) => void) | undefined;
    mocks.roles.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const changed = vi.fn();
    const view = render(<AuthProvider onIdentityChange={changed}><State /></AuthProvider>);
    await emit("INITIAL_SESSION", session);
    await emit("SIGNED_OUT", null);
    await act(async () => { finish?.({ data: [{ role: "system_admin" }], error: null }); });
    await waitFor(() => expect(view.getByRole("status").textContent).toBe("signed-out:"));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith("SIGNED_OUT");
  });
});