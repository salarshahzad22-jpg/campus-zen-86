import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, Link as LinkIcon, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({ meta: [{ title: "Resources — Campus Helper AI" }] }),
  component: ResourcesPage,
});

type Resource = { id: string; title: string; type: string; subject: string | null; url: string | null; content: string | null };
const empty = { title: "", type: "note", subject: "", url: "", content: "" };

function ResourcesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");


  const { data = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Resource[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        title: form.title, type: form.type,
        subject: form.subject || null,
        url: form.url || null,
        content: form.content || null,
        user_id: u.user!.id,
      };
      const { error } = await supabase.from("resources").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Resource saved");
      setOpen(false); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources"] }),
  });

  const filtered = useMemo(
    () => data.filter((r) => {
      const matchesText = [r.title, r.subject ?? "", r.content ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || r.type === typeFilter;
      return matchesText && matchesType;
    }),
    [data, search, typeFilter]
  );


  return (
    <div>
      <PageHeader
        title="Resources"
        description="Save notes and links organized by subject."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add resource</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New resource</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="link">Link</SelectItem>
                        <SelectItem value="file">File reference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={100} />
                  </div>
                </div>
                {form.type !== "note" && (
                  <div>
                    <Label>URL</Label>
                    <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
                  </div>
                )}
                {form.type === "note" && (
                  <div>
                    <Label>Content</Label>
                    <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} maxLength={5000} />
                  </div>
                )}
                <DialogFooter><Button type="submit" disabled={add.isPending}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search resources…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="link">Links</SelectItem>
            <SelectItem value="file">Files / PDFs</SelectItem>
          </SelectContent>
        </Select>
      </div>


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-muted-foreground">No resources yet.</CardContent></Card>
        )}
        {filtered.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.type === "note" ? <FileText className="h-4 w-4 text-primary shrink-0" /> : <LinkIcon className="h-4 w-4 text-accent shrink-0" />}
                  <h3 className="font-semibold truncate">{r.title}</h3>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex gap-2">
                {r.subject && <Badge variant="secondary">{r.subject}</Badge>}
                <Badge variant="outline">{r.type}</Badge>
              </div>
              {r.content && <p className="mt-3 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{r.content}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline break-all">
                  <ExternalLink className="h-3.5 w-3.5" /> {r.url}
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
