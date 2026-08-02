import { useState, useEffect, useCallback } from "react";
import { actions } from "@/lib/rukisha-store";
import { OrgMember } from "@/lib/rukisha-types";
import { X, UserPlus, Trash2, Edit2, Check, ChevronDown, FolderOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orgId: string;
  orgName: string;
  currentUserRole: "Admin" | "PM" | "Staff";
  onClose: () => void;
}

type Tab = "directory" | "invite" | "projects";

const ROLE_COLORS: Record<string, string> = {
  Admin:
    "bg-[var(--rk-navy)]/10 text-[var(--rk-navy)] dark:bg-[var(--rk-gold)]/10 dark:text-[var(--rk-gold)] ring-1 ring-[var(--rk-navy)]/30 dark:ring-[var(--rk-gold)]/30",
  PM: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30",
  Staff: "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-1 ring-slate-400/30",
};

export function OrgUserManagementModal({ orgId: orgIdProp, orgName: orgNameProp, currentUserRole, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("directory");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Resolved org context (handles the "default" sentinel)
  const [resolvedOrgId, setResolvedOrgId] = useState<string>(orgIdProp === "default" ? "" : orgIdProp);
  const [resolvedOrgName, setResolvedOrgName] = useState<string>(orgNameProp);
  const [initError, setInitError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "PM" | "Staff">("Staff");
  const [inviting, setInviting] = useState(false);

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"Admin" | "PM" | "Staff">("Staff");

  // Project assignment
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [memberProjects, setMemberProjects] = useState<
    { projectId: string; projectName: string; role: string }[]
  >([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);
  const [assignProject, setAssignProject] = useState("");
  const [assignRole, setAssignRole] = useState<"Admin" | "PM" | "Staff">("Staff");
  const [loadingProjects, setLoadingProjects] = useState(false);

  const canManage = currentUserRole === "Admin" || currentUserRole === "PM";

  // If orgId is the "default" sentinel, find or create the org automatically
  useEffect(() => {
    if (orgIdProp !== "default") return;
    (async () => {
      setLoading(true);
      // Try to find any existing org
      const { data: orgs } = await (supabase as any)
        .from("rk_organizations")
        .select("id, name")
        .limit(1);
      if (orgs && orgs.length > 0) {
        setResolvedOrgId(orgs[0].id);
        setResolvedOrgName(orgs[0].name);
      } else {
        // Auto-create a default org
        const { data: newOrg, error } = await (supabase as any)
          .from("rk_organizations")
          .insert({ name: "My Organization" })
          .select()
          .single();
        if (error) {
          setInitError("Could not initialize organization. Please run database migrations.");
          setLoading(false);
          return;
        }
        setResolvedOrgId(newOrg.id);
        setResolvedOrgName(newOrg.name);
        // Add current user as Admin
        const email = localStorage.getItem("rk-email")?.trim().toLowerCase();
        if (email) {
          await (supabase as any)
            .from("rk_org_members")
            .insert({ org_id: newOrg.id, email, name: email, role: "Admin" });
        }
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdProp]);

  const fetchMembers = useCallback(async () => {
    if (!resolvedOrgId) return;
    setLoading(true);
    const data = await actions.loadOrgMembers(resolvedOrgId);
    setMembers(data);
    setLoading(false);
  }, [resolvedOrgId]);

  useEffect(() => {
    if (resolvedOrgId) fetchMembers();
  }, [fetchMembers, resolvedOrgId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required.");
      return;
    }
    setInviting(true);
    const result = await actions.inviteOrgMember(resolvedOrgId, inviteEmail, inviteName, inviteRole);
    setInviting(false);
    if (result) {
      setMembers((prev) => [...prev, result]);
      setInviteEmail("");
      setInviteName("");

      setInviteRole("Staff");
      setTab("directory");
    }
  };

  const handleEditSave = async (memberId: string) => {
    const ok = await actions.updateOrgMember(memberId, { name: editName, role: editRole });
    if (ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, name: editName, orgRole: editRole } : m)),
      );
      setEditingId(null);
    }
  };

  const handleRemove = async (member: OrgMember) => {
    if (!confirm(`Remove ${member.name} from the organization?`)) return;
    const ok = await actions.removeOrgMember(member.id);
    if (ok) setMembers((prev) => prev.filter((m) => m.id !== member.id));
  };

  const handleSelectMemberProjects = async (member: OrgMember) => {
    setSelectedMember(member);
    setTab("projects");
    setLoadingProjects(true);
    const [projects, allProj] = await Promise.all([
      actions.getMemberProjects(member.email),
      supabase.from("rk_project" as any).select("id, name").order("name"),
    ]);
    setMemberProjects(projects);
    setAllProjects((allProj.data as any[]) ?? []);
    setLoadingProjects(false);
  };

  const handleAssignProject = async () => {
    if (!selectedMember || !assignProject) {
      toast.error("Select a project first.");
      return;
    }
    const ok = await actions.assignMemberToProject(
      assignProject,
      selectedMember.email,
      selectedMember.name,
      assignRole,
    );
    if (ok) {
      const proj = allProjects.find((p) => p.id === assignProject);
      setMemberProjects((prev) => [
        ...prev,
        { projectId: assignProject, projectName: proj?.name ?? assignProject, role: assignRole },
      ]);
      setAssignProject("");
    }
  };

  const handleUnassignProject = async (projectId: string) => {
    if (!selectedMember) return;
    const ok = await actions.removeMemberFromProject(projectId, selectedMember.email);
    if (ok) setMemberProjects((prev) => prev.filter((p) => p.projectId !== projectId));
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "directory", label: "Directory" },
    ...(canManage ? [{ key: "invite" as Tab, label: "Invite Member" }] : []),
    ...(selectedMember ? [{ key: "projects" as Tab, label: `${selectedMember.name}'s Projects` }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-gradient-to-r from-[var(--rk-navy)]/5 to-transparent">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Organization Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">{resolvedOrgName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 bg-muted/30">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                tab === key
                  ? "border-[var(--rk-navy)] text-[var(--rk-navy)] dark:border-[var(--rk-gold)] dark:text-[var(--rk-gold)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Init error */}
          {initError && (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-3">
              <div className="text-3xl">⚠️</div>
              <p className="text-sm text-red-500 font-medium">{initError}</p>
              <p className="text-xs text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">node migrate.cjs</code> on your server to create the organization tables.
              </p>
            </div>
          )}
          {/* DIRECTORY TAB */}
          {!initError && tab === "directory" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="flex-1 h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 dark:focus:ring-[var(--rk-gold)]/30 transition"
                />
                <button
                  onClick={fetchMembers}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm animate-pulse">
                  Loading members…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <div className="text-3xl mb-2">👥</div>
                  <p className="text-sm text-muted-foreground">
                    {search ? "No members match your search." : "No members yet. Invite someone!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 hover:border-border hover:shadow-sm transition-all group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--rk-navy)]/10 dark:bg-[var(--rk-gold)]/10 text-[var(--rk-navy)] dark:text-[var(--rk-gold)] text-sm font-bold uppercase">
                        {m.name.slice(0, 2)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {editingId === m.id ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full h-7 px-2 text-sm rounded border border-border bg-muted/40 outline-none focus:ring-2 focus:ring-ring"
                            autoFocus
                          />
                        ) : (
                          <div className="font-semibold text-sm text-foreground truncate">{m.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                      </div>

                      {editingId === m.id ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as any)}
                          className="h-7 px-2 text-xs rounded border border-border bg-muted/40 outline-none"
                        >
                          <option>Admin</option>
                          <option>PM</option>
                          <option>Staff</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            ROLE_COLORS[m.orgRole] ?? ""
                          }`}
                        >
                          {m.orgRole}
                        </span>
                      )}

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          {editingId === m.id ? (
                            <>
                              <button
                                onClick={() => handleEditSave(m.id)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleSelectMemberProjects(m)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-[var(--rk-navy)] dark:hover:text-[var(--rk-gold)] hover:bg-muted transition"
                                title="Manage project assignments"
                              >
                                <FolderOpen className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditName(m.name);
                                  setEditRole(m.orgRole);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                title="Edit member"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRemove(m)}
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                                title="Remove from organization"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <div className="pt-2">
                  <button
                    onClick={() => setTab("invite")}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--rk-navy)] dark:text-[var(--rk-gold)] hover:underline"
                  >
                    <UserPlus className="h-4 w-4" />
                    Invite a new member
                  </button>
                </div>
              )}
            </div>
          )}

          {/* INVITE TAB */}
          {!initError && tab === "invite" && canManage && (
            <div className="max-w-md mx-auto space-y-5">
              <p className="text-sm text-muted-foreground">
                Invite someone to join <strong>{resolvedOrgName}</strong>. They'll have access to any
                projects you assign them to.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                    Organization Role
                  </label>
                  <div className="relative">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full h-9 rounded-lg border border-border bg-muted/40 pl-3 pr-8 text-sm outline-none appearance-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 transition"
                    >
                      <option value="Staff">Staff – View & update assigned tasks</option>
                      <option value="PM">PM – Manage projects & team members</option>
                      <option value="Admin">Admin – Full organization control</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    <strong>Staff</strong> can view & update their assigned tasks.{" "}
                    <strong>PM</strong> can create tasks and manage the team.{" "}
                    <strong>Admin</strong> has full control including org settings.
                  </p>
                </div>
              </div>

              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--rk-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? (
                  <span className="animate-pulse">Adding…</span>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add to Organization
                  </>
                )}
              </button>
            </div>
          )}

          {/* PROJECTS TAB */}
          {!initError && tab === "projects" && selectedMember && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--rk-navy)]/10 dark:bg-[var(--rk-gold)]/10 text-[var(--rk-navy)] dark:text-[var(--rk-gold)] text-sm font-bold uppercase">
                  {selectedMember.name.slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{selectedMember.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedMember.email}</div>
                </div>
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    ROLE_COLORS[selectedMember.orgRole] ?? ""
                  }`}
                >
                  {selectedMember.orgRole}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Current Project Assignments
                </h3>
                {loadingProjects ? (
                  <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
                ) : memberProjects.length === 0 ? (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                    Not assigned to any projects yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {memberProjects.map((p) => (
                      <div
                        key={p.projectId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{p.projectName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ROLE_COLORS[p.role] ?? ""
                            }`}
                          >
                            {p.role}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleUnassignProject(p.projectId)}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                              title="Remove from project"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canManage && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Assign to a Project
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={assignProject}
                        onChange={(e) => setAssignProject(e.target.value)}
                        className="w-full h-9 rounded-lg border border-border bg-muted/40 pl-3 pr-8 text-sm outline-none appearance-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 transition"
                      >
                        <option value="">Select a project…</option>
                        {allProjects
                          .filter((p) => !memberProjects.some((mp) => mp.projectId === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="relative">
                      <select
                        value={assignRole}
                        onChange={(e) => setAssignRole(e.target.value as any)}
                        className="h-9 rounded-lg border border-border bg-muted/40 pl-3 pr-8 text-sm outline-none appearance-none focus:ring-2 focus:ring-[var(--rk-navy)]/30 transition"
                      >
                        <option value="Staff">Staff</option>
                        <option value="PM">PM</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    <button
                      onClick={handleAssignProject}
                      disabled={!assignProject}
                      className="h-9 px-4 rounded-lg bg-[var(--rk-navy)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} in organization
          </span>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
