import { useState } from "react";
import { actions, useProject } from "@/lib/rukisha-store";
import type { ProjectState } from "@/lib/rukisha-types";

function toCSV(state: ProjectState): string {
  const rows = [
    ["Section", "Activity", "Owner", "Plan Start", "Plan Duration", "Actual Start", "Actual Duration", "% Complete"],
  ];
  for (const sec of state.sections) {
    for (const t of state.tasks.filter((x) => x.sectionId === sec.id)) {
      rows.push([
        sec.name,
        t.activity,
        t.owner,
        t.planStart,
        String(t.planDuration),
        t.actualStart ?? "",
        String(t.actualDuration),
        String(t.percentComplete),
      ]);
    }
  }
  return rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Toolbar() {
  const state = useProject();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const json = JSON.stringify(state);
    const enc = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}#data=${enc}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Copy this snapshot URL:", url);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-3 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Go-live</span>
        <input
          type="date"
          value={state.goLiveDate}
          onChange={(e) => actions.setGoLive(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Legend />
        <button
          onClick={() => download(`${state.projectName}.csv`, toCSV(state), "text/csv")}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Export CSV
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Print
        </button>
        <button
          onClick={handleShare}
          className="rounded-md bg-[var(--rk-navy)] text-primary-foreground px-3 py-1.5 text-xs hover:opacity-90"
        >
          {copied ? "✓ Link copied" : "Share snapshot"}
        </button>
        <button
          onClick={() => {
            if (confirm("Reset all data to demo defaults?")) actions.reset();
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Planned", color: "var(--rk-bar-planned)", border: "var(--rk-blue)" },
    { label: "In progress", color: "var(--rk-bar-progress)" },
    { label: "Complete", color: "var(--rk-bar-done)" },
    { label: "Overrun", color: "var(--rk-bar-overrun)" },
    { label: "Overrun progressing", color: "var(--rk-bar-overrun-progress)" },
  ];
  return (
    <div className="hidden lg:flex items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded"
            style={{ background: i.color, border: i.border ? `1px solid ${i.border}` : undefined }}
          />
          {i.label}
        </div>
      ))}
    </div>
  );
}
