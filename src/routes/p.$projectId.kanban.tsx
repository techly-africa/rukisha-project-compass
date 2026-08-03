import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/rukisha/AppShell";
import { KanbanView } from "@/components/rukisha/KanbanView";

export const Route = createFileRoute("/p/$projectId/kanban")({
  head: () => ({
    meta: [
      { title: "Compass — Kanban Board" },
      {
        name: "description",
        content: "Visualize tasks as a Kanban board grouped by status or section.",
      },
    ],
  }),
  component: KanbanPage,
});

function KanbanPage() {
  return (
    <AppShell>
      <KanbanView />
    </AppShell>
  );
}
