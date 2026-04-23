import { useState } from "react";
import { actions, useProject, todayISO, type ProjectInfo } from "@/lib/rukisha-store";
import { Link } from "@tanstack/react-router";
import { Compass, Plus, Clock, LayoutGrid, ListTodo, Users, Calendar, Trash2, Archive, ArchiveRestore, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProjectPortfolio() {
  const state = useProject();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const id = await actions.createProject(newTitle.trim());
    if (id) {
      setOpen(false);
      setNewTitle("");
    }
  };

  const filteredProjects = state.userProjects.filter(p => 
    view === "active" ? !p.isArchived : p.isArchived
  );

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
              <p className="text-white/60 text-sm flex items-center gap-2">
                {view === "active" ? "Welcome back to your project command center." : "Reviewing decommissioned project records."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Tabs value={view} onValueChange={(v) => setView(v as any)} className="bg-white/5 border border-white/10 rounded-lg p-1">
              <TabsList className="bg-transparent border-none">
                <TabsTrigger value="active" className="data-[state=active]:bg-white/10 data-[state=active]:text-[var(--rk-gold)] text-white/60 text-xs">Active</TabsTrigger>
                <TabsTrigger value="archived" className="data-[state=archived]:bg-white/10 data-[state=archived]:text-[var(--rk-gold)] text-white/60 text-xs">Archived</TabsTrigger>
              </TabsList>
            </Tabs>

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
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
              <LayoutGrid className="mx-auto h-12 w-12 text-white/10 mb-4" />
              <h2 className="text-white/80 font-medium">{view === "active" ? "No active projects" : "Archive is empty"}</h2>
              <p className="text-white/30 text-sm mt-1 max-w-xs mx-auto">
                {view === "active" 
                  ? "Initialize a new project record using the command button above."
                  : "Decommissioned projects will appear here for historical reference."}
              </p>
            </div>
          ) : (
            filteredProjects.map((p) => <ProjectCard key={p.id} project={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectInfo }) {
  const isSuperAdmin = localStorage.getItem("rk-email")?.toLowerCase() === "cbienaime@rukisha.co.rw";
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("rk_project").delete().eq("id", project.id);
      if (error) throw error;
      
      toast.success("Project deleted successfully");
      await actions.refreshProjects();
    } catch (err) {
      console.error(err);
      toast.error("Deletion failed");
    } finally {
      setShowDelete(false);
    }
  };

  const handleArchiveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await actions.archiveProject(project.id, !project.isArchived);
      toast.success(project.isArchived ? "Project restored to active portfolio" : "Project moved to historical archive");
    } catch (err) {
      console.error(err);
      toast.error("Operation failed");
    }
  };

  return (
    <>
      <Link
        to="/p/$projectId"
        params={{ projectId: project.id }}
        className={`group relative flex flex-col h-full rounded-2xl border transition-all duration-300 shadow-xl overflow-hidden ${
          project.isArchived 
            ? "bg-white/2 border-white/5 grayscale opacity-70 hover:grayscale-0 hover:opacity-100" 
            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
        }`}
      >
        <div className="flex items-start justify-between p-6">
          <div>
            <h2 className="text-xl font-bold text-white group-hover:text-[var(--rk-gold)] transition-colors line-clamp-1">
              {project.name}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-white/40 text-xs">
              {project.isArchived ? <Archive className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>{project.isArchived ? "Decommissioned on " : "Updated "} {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleArchiveToggle}
                className="h-8 w-8 text-white/20 hover:text-[var(--rk-gold)] hover:bg-[var(--rk-gold)]/10 rounded-full transition-colors"
                title={project.isArchived ? "Restore Project" : "Archive Project"}
              >
                {project.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDelete(true);
                }}
                className="h-8 w-8 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                title="Delete Project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-4 p-6 pt-0">
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

        {project.isArchived && (
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <div className="bg-black/80 text-[8px] uppercase tracking-tighter text-white/60 px-2 py-0.5 rounded border border-white/10">Archived</div>
          </div>
        )}
      </Link>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-[var(--rk-navy)] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Confirm Project Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to PERMANENTLY delete <span className="text-white font-bold">"{project.name}"</span>? 
              This action will destroy all mission data, tasks, and stakeholders. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
