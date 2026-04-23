import { useState, useEffect, type ReactNode } from "react";
import { Compass } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { actions } from "@/lib/rukisha-store";

const EMAIL_KEY = "rk-email";

type GateState = "loading" | "allowed" | "prompt";

export function EmailGate({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const [gateState, setGateState] = useState<GateState>("loading");
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // We remove the static setup route exclusion to ensure global coverage
  // A Super Admin can always access through the gate anyway

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const saved = localStorage.getItem(EMAIL_KEY)?.toLowerCase();

    // Optimistic access: if we already have a saved email, trust it immediately.
    // The store's loadAll() will fail gracefully if the email is no longer on the team.
    // This avoids the CORS-blocked check_access RPC call that was freezing the UI.
    if (saved) {
      setGateState("allowed");
      return;
    }

    setGateState("prompt");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const email = emailInput.trim().toLowerCase();

    try {
      // Use get_user_projects instead of check_access to avoid CORS issues.
      // If the user has at least one project OR is a superadmin, grant access.
      const [{ data: projects }, { data: adminRow }] = await Promise.all([
        (supabase as any).rpc("get_user_projects", { p_email: email }),
        (supabase as any).from("rk_superadmins").select("email").eq("email", email).maybeSingle(),
      ]);

      const hasAccess = (projects && projects.length > 0) || !!adminRow;

      if (hasAccess) {
        localStorage.setItem(EMAIL_KEY, email);
        // Trigger the store to load projects now that the email is saved
        actions.refreshProjects();

        setGateState("allowed");
      } else {
        setError("This email is not on the project team. Contact your project admin.");
      }
    } catch {
      setError("Connection error. Please check your network and try again.");
    }

    setSubmitting(false);
  }

  // No exclusions - all routes are gated

  if (gateState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (gateState === "allowed") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--rk-navy)] text-[var(--rk-gold)] shadow-sm">
            <Compass className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Avel Compass</h1>
          <p className="mt-2 text-sm text-muted-foreground">Premium project portfolio for Rukisha.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Secure Access</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your whitelisted email to receive access to the Avel Portfolio.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setError("");
                  }}
                  placeholder="name@rukisha.co.rw"
                  required
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-md bg-[var(--rk-navy)] px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-[var(--rk-navy)]/90 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? "Verifying..." : "Sign in with Email"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Avel Africa.
        </p>
      </div>
    </div>
  );
}
