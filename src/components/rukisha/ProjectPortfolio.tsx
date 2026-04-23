import { useState } from "react";
import { actions, useProject, todayISO, type ProjectInfo } from "@/lib/rukisha-store";
import { Link } from "@tanstack/react-router";
import { Compass, Plus, Clock, LayoutGrid, ListTodo, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ProjectPortfolio() {
  const state = useProject();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const id = await actions.createProject(newTitle.trim());
    if (id) {
      setOpen(false);
      setNewTitle("");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--rk-navy)] p-4 md:p-12 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-[var(--rk-gold)] shadow-xl ring-1 ring-white/20">
              <Compass className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Portfolio</h1>
              <p className="text-white/60 text-sm">Welcome back to your project command center.</p>
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[var(--rk-gold)] text-[var(--rk-navy)] hover:bg-[var(--rk-gold)]/90 h-10 px-6 font-semibold shadow-lg transition-all active:scale-95">
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Start a new project</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">
                    Project Name
                  </label>
                  <Input
                    placeholder="e.g. Q4 Website Relaunch"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} className="bg-[var(--rk-navy)] text-white">
                  Initialize Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.userProjects.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <LayoutGrid className="mx-auto h-12 w-12 text-white/20 mb-4" />
              <h2 className="text-white font-medium">No projects found</h2>
              <p className="text-white/40 text-sm mt-1">
                Start by creating your first project above.
              </p>
            </div>
          ) : (
            state.userProjects.map((p) => <ProjectCard key={p.id} project={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectInfo }) {
  return (
    <Link
      to="/p/$projectId"
      params={{ projectId: project.id }}
      className="group relative flex flex-col h-full rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-xl overflow-hidden"
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white group-hover:text-[var(--rk-gold)] transition-colors line-clamp-1">
            {project.name}
          </h2>
          <div className="flex items-center gap-2 mt-2 text-white/40 text-xs">
            <Clock className="h-3 w-3" />
            <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-white/60">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium">Go-Live</span>
          </div>
          <span className="text-xs font-bold text-[var(--rk-gold)]">{project.goLiveDate}</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--rk-gold)] w-[40%] rounded-full shadow-[0_0_8px_rgba(201,162,39,0.5)]" />
          </div>
          <span className="text-[10px] font-bold text-white/40 ml-2">40%</span>
        </div>
      </div>
    </Link>
  );
}
