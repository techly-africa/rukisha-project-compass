import { useState, useEffect, type ReactNode } from "react";
import { Compass } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_KEY = "rk-email";

type GateState = "loading" | "allowed" | "prompt";

export function EmailGate({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const navigate = useNavigate();
  const [gateState, setGateState] = useState<GateState>("loading");
  const [emailInput, setEmailInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSetupRoute = location.pathname === "/setup";

  useEffect(() => {
    if (isSetupRoute) return;
    checkAccess();
  }, [isSetupRoute]);

  async function checkAccess() {
    const saved = localStorage.getItem(EMAIL_KEY)?.toLowerCase();
    if (!saved) {
      setGateState("prompt");
      return;
    }

    try {
      const { data: hasAccess, error: rpcErr } = await (supabase as any)
        .rpc("check_access", { p_email: saved });

      if (rpcErr || !hasAccess) {
        setGateState("prompt");
        return;
      }
      setGateState("allowed");
    } catch {
      setGateState("prompt");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const email = emailInput.trim().toLowerCase();

    const { data: hasAccess, error: fetchErr } = await (supabase as any)
      .rpc("check_access", { p_email: email });

    if (hasAccess && !fetchErr) {
      localStorage.setItem(EMAIL_KEY, email);
      setGateState("allowed");
    } else {
      setError("This email is not on the project team. Contact your project admin.");
    }
    setSubmitting(false);
  }

  if (isSetupRoute) return <>{children}</>;

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
          <h1 className="text-2xl font-bold tracking-tight">Compass</h1>
          <p className="mt-2 text-sm text-muted-foreground">Project management for modern teams.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Access Project</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your whitelisted email to continue.
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
