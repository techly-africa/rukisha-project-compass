// Custom HTTP Proxy Client replacing @supabase/supabase-js
// Forwards all database queries and storage requests to our Express server backend

class QueryBuilder {
  private table?: string;
  private rpcName?: string;
  private action: "select" | "insert" | "update" | "delete" | "rpc" = "select";
  private data: any = null;
  private filters: { field: string; op: string; value: any }[] = [];
  private orderFields: { field: string; ascending: boolean }[] = [];
  private limitCount?: number;
  private singleRow = false;

  constructor(
    table?: string,
    rpcName?: string,
    action: "select" | "insert" | "update" | "delete" | "rpc" = "select",
  ) {
    this.table = table;
    this.rpcName = rpcName;
    this.action = action;
  }

  select(columns = "*") {
    // Ignore columns as the backend returns full rows
    return this;
  }

  insert(data: any) {
    this.action = "insert";
    this.data = data;
    return this;
  }

  update(patch: any) {
    this.action = "update";
    this.data = patch;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: "in", value: values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderFields.push({ field, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleRow = true;
    return this;
  }

  maybeSingle() {
    this.singleRow = true;
    return this;
  }

  // Thenable implementation to support await/promise semantics directly on the builder chain
  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const email = typeof window !== "undefined" ? localStorage.getItem("rk-email") : null;

      const res = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": email || "",
        },
        body: JSON.stringify({
          table: this.table,
          rpc: this.rpcName,
          action: this.action,
          data: this.data,
          filters: this.filters,
          order: this.orderFields,
          limit: this.limitCount,
          single: this.singleRow,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "API error");
      }

      const json = await res.json();

      // Supabase client returns { data, error }
      if (onfulfilled) {
        return onfulfilled(json);
      }
      return json;
    } catch (err: any) {
      const errorObj = { data: null, error: { message: err.message || err } };
      if (onrejected) {
        return onrejected(errorObj);
      }
      return errorObj;
    }
  }
}

// Storage API client mimicking supabase.storage
const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              if (typeof reader.result === "string") {
                const base64 = reader.result.split(",")[1];
                resolve(base64);
              } else {
                reject(new Error("Failed to read file as base64"));
              }
            };
            reader.onerror = reject;
          });

          reader.readAsDataURL(file);
          const base64Data = await base64Promise;

          const email = typeof window !== "undefined" ? localStorage.getItem("rk-email") : null;
          const res = await fetch("/api/storage/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-email": email || "",
            },
            body: JSON.stringify({
              bucket,
              path,
              name: file.name,
              type: file.type,
              size: file.size,
              fileData: base64Data,
            }),
          });

          if (!res.ok) {
            throw new Error(await res.text());
          }

          return { data: { path }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || err } };
        }
      },

      async download(path: string) {
        try {
          const email = typeof window !== "undefined" ? localStorage.getItem("rk-email") : null;
          const res = await fetch(
            `/api/storage/download?bucket=${bucket}&path=${encodeURIComponent(path)}`,
            {
              headers: {
                "x-user-email": email || "",
              },
            },
          );

          if (!res.ok) {
            throw new Error(await res.text());
          }

          const blob = await res.blob();
          return { data: blob, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || err } };
        }
      },

      async remove(paths: string[]) {
        try {
          const email = typeof window !== "undefined" ? localStorage.getItem("rk-email") : null;
          const res = await fetch("/api/storage/remove", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-email": email || "",
            },
            body: JSON.stringify({ bucket, paths }),
          });

          if (!res.ok) {
            throw new Error(await res.text());
          }

          return { data: paths, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message || err } };
        }
      },
    };
  },
};

// Main Export mimicking Supabase SDK instance
export const supabase = {
  from(table: string): any {
    return new QueryBuilder(table, undefined, "select") as any;
  },

  rpc(name: string, args?: any): any {
    return new QueryBuilder(undefined, name, "rpc").insert(args) as any;
  },

  storage: storage as any,

  // Realtime channel stubbed as a no-op
  channel(name: string) {
    return {
      on(event: string, filter: any, callback: () => void) {
        return this;
      },
      subscribe() {
        return this;
      },
    };
  },

  removeChannel(channel: any) {
    // no-op
  },
};
