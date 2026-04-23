import { createFileRoute } from "@tanstack/react-router";
import { ProjectPortfolio } from "@/components/rukisha/ProjectPortfolio";
import { useHydratedProject } from "@/lib/rukisha-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Compass — Portfolio" },
      { name: "description", content: "Compass project tracker — your project portfolio." },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  useHydratedProject(); // Load user projects
  return <ProjectPortfolio />;
}
