import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/rukisha/AppShell";
import { Dashboard } from "@/components/rukisha/Dashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Rukisha Project Tracker" },
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
