import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/rukisha-store";
import { 
  File, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  FileImage, 
  FileCode, 
  MoreHorizontal,
  Search,
  HardDrive,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface DocInfo {
  id: string;
  name: string;
  storage_path: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  created_by: string;
}

export function DocumentVault() {
  const state = useProject();
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [docToDelete, setDocToDelete] = useState<DocInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.id) fetchDocs();
  }, [state.id]);

  const fetchDocs = async () => {
    try {
      if (!state.id) return;
      const { data, error } = await (supabase as any)
        .from("rk_documents")
        .select("*")
        .eq("project_id", state.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load vault documents");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !state.id) return;

    setUploading(true);
    const path = `${state.id}/${Date.now()}-${file.name}`;
    const userEmail = localStorage.getItem("rk-email") || "unknown";

    try {
      // 1. Upload to Storage
      const { error: storageErr } = await supabase.storage
        .from("project_vault")
        .upload(path, file);

      if (storageErr) throw storageErr;

      // 2. Insert Metadata via RPC to bypass RLS recursion/session loss
      const { error: dbErr } = await (supabase as any).rpc("vault_document", {
        p_project_id: state.id,
        p_name: file.name,
        p_path: path,
        p_type: file.type,
        p_size: file.size,
        p_email: userEmail
      });

      if (dbErr) throw dbErr;

      toast.success("Document vaulted successfully");
      fetchDocs();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadFile = async (doc: DocInfo) => {
    try {
      const { data, error } = await supabase.storage
        .from("project_vault")
        .download(doc.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    }
  };

  const deleteFile = async (doc: DocInfo) => {
    try {
      // 1. Delete from storage
      await supabase.storage.from("project_vault").remove([doc.storage_path]);
      
      // 2. Delete metadata
      await (supabase as any).from("rk_documents").delete().eq("id", doc.id);

      toast.success("Document removed");
      fetchDocs();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    } finally {
      setDocToDelete(null);
    }
  };

  const filteredDocs = docs.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes("image")) return <FileImage className="h-5 w-5 text-blue-500" />;
    if (type.includes("code") || type.includes("json")) return <FileCode className="h-5 w-5 text-green-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--rk-navy)] dark:text-white flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-[var(--rk-gold)]" />
            Document Vault
          </h1>
          <p className="text-muted-foreground mt-1">Secure repository for mission-critical documentation.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-[var(--rk-navy)] text-white hover:bg-[var(--rk-navy)]/90 px-6 font-semibold"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-bounce" /> Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Deposit File
              </span>
            )}
          </Button>
        </div>
      </header>

      <div className="grid gap-4">
        {filteredDocs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl bg-card/30">
            <File className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="font-medium text-lg">Vault is Empty</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
              Securely upload important project briefings, architectural diagrams, or team assets.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Size</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Added</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {getIcon(doc.content_type)}
                        <span className="font-medium text-[var(--rk-navy)] dark:text-white line-clamp-1">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs">
                      {formatSize(doc.size_bytes)}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-muted rounded border border-border">
                        {doc.created_by.split("@")[0]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 outline-none">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => downloadFile(doc)}
                          className="h-8 w-8 hover:text-[var(--rk-navy)]"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setDocToDelete(doc)}
                          className="h-8 w-8 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Remove Document
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to PERMANENTLY remove <span className="text-[var(--rk-navy)] font-bold">"{docToDelete?.name}"</span> from the high-security vault?
              This action will delete the physical file from storage and its metadata records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Document</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => docToDelete && deleteFile(docToDelete)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
