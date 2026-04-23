import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Compass, LogOut } from "lucide-react";
import { actions, useHydratedProject, useIsLoaded, useProject } from "@/lib/rukisha-store";
import { toast } from "sonner";

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const state = useProject();
  const isLoaded = useIsLoaded();
  const { location } = useRouterState();
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (state.darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [state.darkMode]);

  const handleLogout = () => {
    toast("Ready to leave?", {
      description: "You'll need to enter your email again to access your projects.",
      action: {
        label: "Logout",
        onClick: () => {
          localStorage.removeItem("rk-email");
          window.location.reload();
        },
      },
    });
  };

  const navItems = [
    {
      to: "/",
      label: "Portfolio",
      d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      params: {},
    },
    ...(state.id
      ? [
          {
            to: "/p/$projectId",
            label: "Gantt",
            d: "M3 6h7M3 12h12M3 18h5",
            params: { projectId: state.id },
          },
          {
            to: "/p/$projectId/dashboard",
            label: "Dashboard",
            d: "M3 12h4l3-9 4 18 3-9h4",
            params: { projectId: state.id },
          },
          {
            to: "/p/$projectId/setup",
            label: "Setup",
            d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z",
            params: { projectId: state.id },
          },
        ]
      : []),
  ] as const;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-all duration-300">
      <aside
        className={`no-print relative hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-300 md:flex ${
          isCollapsed ? "w-[68px]" : "w-60"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rk-navy)] text-[var(--rk-gold)]">
            <Compass className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="text-sm font-semibold leading-tight">Compass</div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">Project Tracker</div>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((n) => {
            const active = location.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                params={n.params as Record<string, string>}
                title={isCollapsed ? n.label : undefined}
                className={`flex items-center rounded-md transition-all duration-200 ${
                  isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2 text-sm"
                } ${
                  active
                    ? "bg-[var(--rk-navy)] text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon d={n.d} className={isCollapsed ? "h-6 w-6" : "h-5 w-5"} />
                {!isCollapsed && (
                  <span className="animate-in fade-in slide-in-from-left-1 duration-300">
                    {n.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-16 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground active:scale-95"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="mt-auto flex flex-col gap-1 p-3">
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
            className={`flex items-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 ${
              isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2 text-sm"
            }`}
          >
            <LogOut className={isCollapsed ? "h-6 w-6" : "h-5 w-5"} />
            {!isCollapsed && (
              <span className="animate-in fade-in slide-in-from-left-1 duration-300">Logout</span>
            )}
          </button>

          <div className="mt-2 border-t border-border/50 pt-3 px-1">
            {isCollapsed ? (
              <div
                className="flex justify-center text-[var(--rk-gold)]"
                title={`Go-live: ${state.goLiveDate}`}
              >
                ★
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Go-live
                </div>
                <div className="text-foreground font-semibold text-sm">{state.goLiveDate}</div>
              </div>
            )}
          </div>
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
            <Link
              to="/p/$projectId"
              params={{ projectId: state.id! }}
              className="md:hidden text-xs px-2 py-1 rounded border border-border"
            >
              Gantt
            </Link>
            <Link
              to="/p/$projectId/dashboard"
              params={{ projectId: state.id! }}
              className="md:hidden text-xs px-2 py-1 rounded border border-border"
            >
              Dash
            </Link>
            <button
              onClick={() => actions.toggleDark()}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              aria-label="Toggle dark mode"
            >
              {state.darkMode ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          {mounted && isLoaded ? (
            children
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading project from Lovable Cloud…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
