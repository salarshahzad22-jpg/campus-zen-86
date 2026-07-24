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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: "Exams — Campus Helper AI" }] }),
  component: ExamsPage,
});

type Exam = { id: string; title: string; subject: string; exam_date: string; prep_status: string; notes: string | null };
const empty = { title: "", subject: "", exam_date: "", prep_status: "not_started", notes: "" };

function ExamsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").order("exam_date");
      if (error) throw error;
      return data as Exam[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, notes: form.notes || null };
      if (editing) {
        const { error } = await supabase.from("exams").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("exams").insert({ ...payload, user_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Exam updated" : "Exam added");
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const filtered = useMemo(
    () => data.filter((e) => [e.title, e.subject].join(" ").toLowerCase().includes(search.toLowerCase())),
    [data, search]
  );

  function openEdit(e: Exam) {
    setEditing(e);
    setForm({ title: e.title, subject: e.subject, exam_date: e.exam_date, prep_status: e.prep_status, notes: e.notes ?? "" });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Exam Planner"
        description="Track upcoming exams and your prep progress."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setForm(empty); }}>
                <Plus className="mr-2 h-4 w-4" /> New exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit exam" : "New exam"}</DialogTitle></DialogHeader>
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
                    <Label>Exam date</Label>
                    <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label>Prep status</Label>
                  <Select value={form.prep_status} onValueChange={(v) => setForm({ ...form, prep_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="revising">Revising</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />
                </div>
                <DialogFooter><Button type="submit" disabled={save.isPending}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search exams…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="p-10 text-center text-muted-foreground">No exams yet.</CardContent></Card>
        )}
        {filtered.map((e) => {
          const days = differenceInDays(new Date(e.exam_date), new Date());
          return (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{e.title}</h3>
                    <p className="text-sm text-muted-foreground">{e.subject}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge>{format(new Date(e.exam_date), "MMM d, yyyy")}</Badge>
                  <Badge variant={days < 0 ? "outline" : days <= 7 ? "destructive" : "secondary"}>
                    {days < 0 ? "Passed" : days === 0 ? "Today" : `${days}d away`}
                  </Badge>
                  <Badge variant="outline">{e.prep_status.replace("_", " ")}</Badge>
                </div>
                {e.notes && <p className="mt-3 text-sm">{e.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
