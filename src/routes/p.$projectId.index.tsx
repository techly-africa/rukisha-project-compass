import { createFileRoute } from "@tanstack/react-router";
import { GanttChart } from "@/components/rukisha/GanttChart";
import { Toolbar } from "@/components/rukisha/Toolbar";
import { AppShell } from "@/components/rukisha/AppShell";

export const Route = createFileRoute("/p/$projectId/")({
  head: () => ({
    meta: [
      { title: "Compass — Gantt" },
      { name: "description", content: "Compass project tracker — Gantt timeline view." },
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
