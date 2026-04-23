import { useState, useEffect } from "react";
import { Compass, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { actions, useProject } from "@/lib/rukisha-store";
import { toast } from "sonner";
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

interface TeamRow {
  id?: string;
  email: string;
  name: string;
}

interface StakeholderRow {
  id?: string;
  name: string;
  role: string;
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SetupPage() {
  const navigate = useNavigate();
  const state = useProject();
  const [projectId, setProjectId] = useState<string | null>(state.id);
  const [projectName, setProjectName] = useState(state.projectName);
  const [goLiveDate, setGoLiveDate] = useState(state.goLiveDate);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderRow[]>(
    state.stakeholders.length > 0
      ? state.stakeholders.map((s) => ({ id: s.id, name: s.name, role: s.role }))
      : [{ name: "", role: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (state.id) {
      setProjectId(state.id);
      setProjectName(state.projectName);
      setGoLiveDate(state.goLiveDate);
      setStakeholders(
        state.stakeholders.length > 0
          ? state.stakeholders.map((s) => ({ id: s.id, name: s.name, role: s.role }))
          : [{ name: "", role: "" }],
      );
      loadTeam(state.id);
    } else {
      setLoading(false);
    }
  }, [state.id]);

  async function loadTeam(id: string) {
    const { data } = await supabase.from("rk_team").select("*").eq("project_id", id);
    if (data && data.length > 0) {
      setTeam(data.map((r) => ({ id: r.id, email: r.email, name: r.name || "" })));
    } else {
      setTeam([{ email: "", name: "" }]);
    }
    setLoading(false);
  }

  function addMember() {
    setTeam((t) => [...t, { email: "", name: "" }]);
  }

  function updateMember(idx: number, field: "email" | "name", value: string) {
    setTeam((t) => t.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function removeMember(idx: number) {
    if (team.length === 1) return;
    setTeam((t) => t.filter((_, i) => i !== idx));
  }

  function addStakeholder() {
    setStakeholders((s) => [...s, { name: "", role: "" }]);
  }

  function updateStakeholder(idx: number, field: "name" | "role", value: string) {
    setStakeholders((s) => s.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  function removeStakeholder(idx: number) {
    if (stakeholders.length === 1) return;
    setStakeholders((s) => s.filter((_, i) => i !== idx));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validTeam = team.filter((m) => m.email.trim());
    if (validTeam.length === 0) {
      setError("Add at least one team member email.");
      return;
    }

    const validStakeholders = stakeholders.filter((s) => s.name.trim());

    setSaving(true);
    try {
      let pid = projectId;

      if (!pid) {
        const { data, error: createErr } = await supabase
          .from("rk_project")
          .insert({ name: projectName, go_live_date: goLiveDate })
          .select()
          .single();
        if (createErr || !data) throw new Error("Failed to create project");
        pid = data.id;
        setProjectId(pid);
      } else {
        await supabase
          .from("rk_project")
          .update({
            name: projectName,
            go_live_date: goLiveDate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pid);
      }

      // Replace team and stakeholders
      await Promise.all([
        supabase.from("rk_team").delete().eq("project_id", pid),
        supabase.from("rk_stakeholders").delete().eq("project_id", pid),
      ]);

      await Promise.all([
        supabase.from("rk_team").insert(
          validTeam.map((m) => ({
            project_id: pid!,
            email: m.email.trim().toLowerCase(),
            name: m.name.trim(),
          })),
        ),
        supabase.from("rk_stakeholders").insert(
          validStakeholders.map((s: StakeholderRow) => ({
            project_id: pid!,
            name: s.name.trim(),
            role: s.role.trim(),
          })),
        ),
      ]);

      await actions.switchProject(pid!);
      navigate({ to: "/p/$projectId", params: { projectId: pid! } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    const isSuperAdmin = localStorage.getItem("rk-email")?.toLowerCase() === "cbienaime@rukisha.co.rw";
    if (!isSuperAdmin) {
      setError("Only Super Admins can delete projects.");
      return;
    }

    setSaving(true);
    try {
      if (!projectId) throw new Error("No project ID found");
      const { error: delErr } = await (supabase as any).from("rk_project").delete().eq("id", projectId);
      if (delErr) throw delErr;
      
      toast.success("Project deleted successfully");
      navigate({ to: "/" });
    } catch (err) {
      console.error(err);
      setError("Failed to delete project. Ensure you are authorized.");
      setSaving(false);
      setShowDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isEditing = !!projectId;

  return (
    <div className="bg-background">

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">
            {isEditing ? "Project Settings" : "Project Configuration"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing
              ? "Update your project details and manage team access."
              : "Define your project, stakeholders and invite your team."}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Project details */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project Details
            </h2>
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  placeholder="e.g. Product Launch Q3"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Target Go-Live Date</label>
                <input
                  type="date"
                  value={goLiveDate}
                  onChange={(e) => setGoLiveDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </section>

          {/* Team members */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Team Members
            </h2>
            <p className="text-xs text-muted-foreground">
              Only these email addresses will be able to access the platform.
            </p>
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              {team.map((member, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="email"
                    value={member.email}
                    onChange={(e) => updateMember(idx, "email", e.target.value)}
                    placeholder="Email address"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(idx, "name", e.target.value)}
                    placeholder="Name (optional)"
                    className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(idx)}
                    disabled={team.length === 1}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                    aria-label="Remove member"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMember}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <PlusIcon />
                Add team member
              </button>
            </div>
          </section>

          {/* Stakeholders */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stakeholders
            </h2>
            <p className="text-xs text-muted-foreground">
              Define the key stakeholders for this project and their roles.
            </p>
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              {stakeholders.map((person, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updateStakeholder(idx, "name", e.target.value)}
                    placeholder="Stakeholder Name"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={person.role}
                    onChange={(e) => updateStakeholder(idx, "role", e.target.value)}
                    placeholder="Role (e.g. Sponsor)"
                    className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => removeStakeholder(idx)}
                    disabled={stakeholders.length === 1}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                    aria-label="Remove stakeholder"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addStakeholder}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <PlusIcon />
                Add stakeholder
              </button>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-[var(--rk-navy)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Project"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                disabled={saving}
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={() => navigate({ to: "/p/$projectId", params: { projectId: projectId! } })}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Permanent Mission Destruction
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to PERMANENTLY delete this project and all its platform data? 
                This action cannot be undone and will revoke access for all team members.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abort Deletion</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
                Confirm Destruction
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
