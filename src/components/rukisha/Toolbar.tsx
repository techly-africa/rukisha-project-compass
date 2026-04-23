import { useState } from "react";
import { actions, useProject } from "@/lib/rukisha-store";
import type { ProjectState } from "@/lib/rukisha-types";
import { toast } from "sonner";

function toCSV(state: ProjectState): string {
  const rows = [
    [
      "Section",
      "Activity",
      "Owner",
      "Plan Start",
      "Plan Duration",
      "Actual Start",
      "Actual Duration",
      "% Complete",
    ],
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
  return rows
    .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n");
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
      toast.success("Snapshot link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link. Please manually copy the URL from the browser bar.");
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b border-border bg-card/60 px-4 py-3 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Go-live</span>
        <input
          type="date"
          value={state.goLiveDate}
          onChange={(e) => actions.setGoLive(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[var(--rk-navy)]"
        />
      </div>

      <div className="mx-4 hidden lg:block">
        <Legend />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
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

        {typeof window !== "undefined" &&
          localStorage.getItem("rk-email")?.toLowerCase() === "cbienaime@rukisha.co.rw" && (
            <button
              onClick={() => {
                toast("Reset all project data?", {
                  description:
                    "This will permanently clear all tasks and stakeholders in the cloud.",
                  action: {
                    label: "Reset",
                    onClick: () => actions.reset(),
                  },
                });
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Reset
            </button>
          )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-6 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 bg-[#CBBED1] opacity-70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.4)_2px,rgba(255,255,255,0.4)_4px)] rounded-[1px]" />
        <span>Plan Duration</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 bg-[#CBBED1] opacity-90 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_2px,rgba(255,255,255,0.3)_2px,rgba(255,255,255,0.3)_4px)] rounded-[1px]" />
        <span>Actual Start</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 bg-[var(--rk-navy)] rounded-[1px]" />
        <span>% Complete</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 bg-[#E6AC5C] opacity-70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.4)_2px,rgba(255,255,255,0.4)_4px)] rounded-[1px]" />
        <span>Actual (beyond plan)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 bg-[#E6AC5C] rounded-[1px]" />
        <span>% Complete (beyond plan)</span>
      </div>
    </div>
  );
}
