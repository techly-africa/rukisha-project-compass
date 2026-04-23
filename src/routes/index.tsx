import { createFileRoute } from "@tanstack/react-router";
import { GanttChart } from "@/components/rukisha/GanttChart";
import { Toolbar } from "@/components/rukisha/Toolbar";
import { AppShell } from "@/components/rukisha/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rukisha Project Tracker — Gantt" },
      { name: "description", content: "Beautiful Gantt-style project tracker for launches and rollouts." },
    ],
  }),
  component: GanttPage,
});

function GanttPage() {
  return (
    <AppShellWrapper>
      <Toolbar />
      <GanttChart />
    </AppShellWrapper>
  );
}

function AppShellWrapper({ children }: { children: React.ReactNode }) {
  // AppShell renders its own Outlet via __root in real usage, but here both routes wrap themselves.
  return <AppShell>{children}</AppShell>;
}
