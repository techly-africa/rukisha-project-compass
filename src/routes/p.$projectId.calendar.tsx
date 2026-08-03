import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/rukisha/AppShell";
import { CalendarView } from "@/components/rukisha/CalendarView";

export const Route = createFileRoute("/p/$projectId/calendar")({
  head: () => ({
    meta: [
      { title: "Compass — Calendar" },
      {
        name: "description",
        content: "Monthly calendar view of all project tasks and milestones.",
      },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <AppShell>
      <CalendarView />
    </AppShell>
  );
}
