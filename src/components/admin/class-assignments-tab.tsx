import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ClassAssignment = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  max_marks: number;
  published: boolean;
};

const empty = { title: "", subject: "", description: "", due_date: "", max_marks: "100", published: true };

export function ClassAssignmentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassAssignment | null>(null);
  const [form, setForm] = useState(empty);

  const query = useQuery({
    queryKey: ["admin-class-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClassAssignment[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        title: form.title.trim(),
        subject: form.subject.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        max_marks: Number(form.max_marks) || 100,
        published: form.published,
      };
      if (!payload.title || !payload.subject) throw new Error("Title and subject are required");
      if (editing) {
        const { error } = await supabase.from("class_assignments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_assignments")
          .insert({ ...payload, author_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-class-assignments"] });
      qc.invalidateQueries({ queryKey: ["class-assignments"] });
      toast.success(editing ? "Assignment updated" : "Assignment posted");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-class-assignments"] });
      toast.success("Assignment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(c: ClassAssignment) {
    setEditing(c);
    setForm({
      title: c.title,
      subject: c.subject,
      description: c.description ?? "",
      due_date: c.due_date ?? "",
      max_marks: String(Number(c.max_marks)),
      published: c.published,
    });
    setOpen(true);
  }

  const items = query.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Class assignments</CardTitle>
        <Button onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Post assignment
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-muted" />)}</div>
        ) : query.isError ? (
          <p className="py-8 text-center text-sm text-destructive">{(query.error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No class assignments posted yet.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.title}</p>
                    <Badge variant="outline">{c.subject}</Badge>
                    <Badge variant={c.published ? "secondary" : "outline"}>{c.published ? "Visible" : "Hidden"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.due_date ? `Due ${format(new Date(c.due_date), "MMM d, yyyy")} · ` : ""}
                    {Number(c.max_marks)} marks
                  </p>
                  {c.description && <p className="mt-2 text-sm">{c.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit assignment" : "Post class assignment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={100} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Maximum marks</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={form.max_marks}
                onChange={(e) => setForm({ ...form, max_marks: e.target.value })}
              />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Visible to students</p>
                <p className="text-xs text-muted-foreground">Turn off to keep it as a draft.</p>
              </div>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
