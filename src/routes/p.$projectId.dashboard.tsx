import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/rukisha/AppShell";
import { Dashboard } from "@/components/rukisha/Dashboard";

export const Route = createFileRoute("/p/$projectId/dashboard")({
  head: () => ({
    meta: [
      { title: "Compass — Dashboard" },
      { name: "description", content: "Project status, milestones and progress overview." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
