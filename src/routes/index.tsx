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
    <AppShell>
      <Toolbar />
      <GanttChart />
    </AppShell>
  );
}
