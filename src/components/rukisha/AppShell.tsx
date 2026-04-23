import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { actions, useHydratedProject, useIsLoaded, useProject } from "@/lib/rukisha-store";

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-5 w-5"}>
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  useHydratedProject();
  const state = useProject();
  const isLoaded = useIsLoaded();
  const { location } = useRouterState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (state.darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [state.darkMode]);

  const navItems = [
    { to: "/", label: "Gantt", d: "M3 6h7M3 12h12M3 18h5" },
    { to: "/dashboard", label: "Dashboard", d: "M3 12h4l3-9 4 18 3-9h4" },
  ] as const;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--rk-navy)] text-[var(--rk-gold)] font-bold">R</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Rukisha</div>
            <div className="text-xs text-muted-foreground">Project Tracker</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((n) => {
            const active = location.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[var(--rk-navy)] text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon d={n.d} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 text-xs text-muted-foreground">
          <div>Go-live</div>
          <div className="text-foreground font-medium">{state.goLiveDate}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <input
              value={state.projectName}
              onChange={(e) => actions.setProjectName(e.target.value)}
              className="min-w-0 truncate bg-transparent text-base font-semibold outline-none focus:ring-2 focus:ring-ring rounded px-2 py-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="md:hidden text-xs px-2 py-1 rounded border border-border">Gantt</Link>
            <Link to="/dashboard" className="md:hidden text-xs px-2 py-1 rounded border border-border">Dash</Link>
            <button
              onClick={() => actions.toggleDark()}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              aria-label="Toggle dark mode"
            >
              {state.darkMode ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
