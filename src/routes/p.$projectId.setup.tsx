import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from "@/components/rukisha/AppShell";
import { SetupPage } from "@/components/rukisha/SetupPage";

export const Route = createFileRoute("/p/$projectId/setup")({
  head: () => ({
    meta: [
      { title: "Compass — Project Setup" },
      { name: "description", content: "Set up your project and define team access." },
    ],
  }),
  component: () => (
    <AppShell>
      <SetupPage />
    </AppShell>
  ),
});
