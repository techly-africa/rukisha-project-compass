import { createFileRoute } from "@tanstack/react-router";
import { DocumentVault } from "@/components/rukisha/DocumentVault";
import { AppShell } from "@/components/rukisha/AppShell";

export const Route = createFileRoute("/p/$projectId/vault")({
  head: () => ({
    meta: [
      { title: "Compass — Document Vault" },
      { name: "description", content: "Secure repository for project documents." },
    ],
  }),
  component: () => (
    <AppShell>
      <DocumentVault />
    </AppShell>
  ),
});
