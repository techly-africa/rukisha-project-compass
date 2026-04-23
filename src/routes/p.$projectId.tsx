import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useHydratedProject, useIsLoaded } from "@/lib/rukisha-store";

export const Route = createFileRoute("/p/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const isLoaded = useIsLoaded();

  useHydratedProject(projectId);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rk-navy)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[var(--rk-gold)]" />
          <span className="text-white/40 text-sm font-medium">Hydrating Project...</span>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
