import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, Clock, FileUp, RotateCcw, Send, Trophy, Download, Trash2, Pencil } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Student portal — Campus Zen" },
      { name: "description", content: "Submit assignments, view grades and feedback, and track your academic progress." },
      { property: "og:title", content: "Student portal — Campus Zen" },
      { property: "og:description", content: "Submit assignments, view grades and feedback, and track your academic progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

type ClassAssignment = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  max_marks: number;
};

type Submission = {
  id: string;
  class_assignment_id: string | null;
  assignment_id: string | null;
  title: string;
  subject: string;
  content: string | null;
  link_url: string | null;
  file_path: string | null;
  file_name: string | null;
  status: string;
  marks: number | null;
  max_marks: number;
  feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  needs_changes: "Changes requested",
  graded: "Graded",
};

function statusVariant(status: string) {
  if (status === "graded") return "default" as const;
  if (status === "approved") return "secondary" as const;
  if (status === "needs_changes") return "destructive" as const;
  return "outline" as const;
}

const emptyForm = {
  source: "class" as "class" | "personal",
  classAssignmentId: "",
  assignmentId: "",
  title: "",
  subject: "",
  content: "",
  link_url: "",
};

function PortalPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);

  const classQuery = useQuery({
    queryKey: ["class-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_assignments")
        .select("id, title, subject, description, due_date, max_marks")
        .eq("published", true)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as ClassAssignment[];
    },
  });

  const personalQuery = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select("id, title, subject").order("due_date");
      if (error) throw error;
      return data as { id: string; title: string; subject: string }[];
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  const submissions = submissionsQuery.data ?? [];
  const classAssignments = classQuery.data ?? [];

  const submittedFor = useMemo(
    () => new Set(submissions.map((s) => s.class_assignment_id).filter(Boolean) as string[]),
    [submissions],
  );

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;

      let title = form.title.trim();
      let subject = form.subject.trim();
      let maxMarks = 100;

      if (!editing) {
        if (form.source === "class") {
          const ca = classAssignments.find((c) => c.id === form.classAssignmentId);
          if (!ca) throw new Error("Choose a class assignment");
          title = ca.title;
          subject = ca.subject;
          maxMarks = Number(ca.max_marks);
        } else {
          const pa = (personalQuery.data ?? []).find((a) => a.id === form.assignmentId);
          if (!pa) throw new Error("Choose one of your assignments");
          title = pa.title;
          subject = pa.subject;
        }
      }

      if (!form.content.trim() && !form.link_url.trim() && !file && !editing?.file_path) {
        throw new Error("Add a file, a link, or some text before submitting");
      }

      let filePath = editing?.file_path ?? null;
      let fileName = editing?.file_name ?? null;
      if (file) {
        const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("submissions").upload(path, file);
        if (upErr) throw upErr;
        filePath = path;
        fileName = file.name;
      }

      if (editing) {
        const { error } = await supabase
          .from("submissions")
          .update({
            content: form.content.trim() || null,
            link_url: form.link_url.trim() || null,
            file_path: filePath,
            file_name: fileName,
            status: "submitted",
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert({
          user_id: uid,
          class_assignment_id: form.source === "class" ? form.classAssignmentId : null,
          assignment_id: form.source === "personal" ? form.assignmentId : null,
          title,
          subject,
          content: form.content.trim() || null,
          link_url: form.link_url.trim() || null,
          file_path: filePath,
          file_name: fileName,
          max_marks: maxMarks,
          status: "submitted",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
      toast.success(editing ? "Submission updated" : "Submitted for review");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (s: Submission) => {
      const { error } = await supabase.from("submissions").delete().eq("id", s.id);
      if (error) throw error;
      if (s.file_path) await supabase.storage.from("submissions").remove([s.file_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
      toast.success("Submission withdrawn");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("submissions").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Could not open the file");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function startNew(classAssignmentId?: string) {
    setEditing(null);
    setFile(null);
    setForm({
      ...emptyForm,
      source: classAssignmentId ? "class" : "class",
      classAssignmentId: classAssignmentId ?? "",
    });
    setOpen(true);
  }

  function startEdit(s: Submission) {
    setEditing(s);
    setFile(null);
    setForm({
      ...emptyForm,
      source: s.class_assignment_id ? "class" : "personal",
      classAssignmentId: s.class_assignment_id ?? "",
      assignmentId: s.assignment_id ?? "",
      title: s.title,
      subject: s.subject,
      content: s.content ?? "",
      link_url: s.link_url ?? "",
    });
    setOpen(true);
  }

  // ---- progress analytics ----
  const graded = submissions.filter((s) => s.status === "graded" && s.marks != null);
  const average = graded.length
    ? Math.round(
        (graded.reduce((sum, s) => sum + (Number(s.marks) / Number(s.max_marks || 100)) * 100, 0) / graded.length) * 10,
      ) / 10
    : 0;

  const bySubject = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    graded.forEach((s) => {
      const pct = (Number(s.marks) / Number(s.max_marks || 100)) * 100;
      const cur = map.get(s.subject) ?? { total: 0, count: 0 };
      map.set(s.subject, { total: cur.total + pct, count: cur.count + 1 });
    });
    return Array.from(map.entries())
      .map(([subject, v]) => ({ subject, average: Math.round((v.total / v.count) * 10) / 10, count: v.count }))
      .sort((a, b) => b.average - a.average);
  }, [graded]);

  const trend = useMemo(
    () =>
      [...graded]
        .sort((a, b) => (a.reviewed_at ?? a.created_at).localeCompare(b.reviewed_at ?? b.created_at))
        .map((s) => ({
          date: format(new Date(s.reviewed_at ?? s.created_at), "MMM d"),
          score: Math.round((Number(s.marks) / Number(s.max_marks || 100)) * 1000) / 10,
        })),
    [graded],
  );

  const counts = {
    submitted: submissions.filter((s) => s.status === "submitted").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    needs_changes: submissions.filter((s) => s.status === "needs_changes").length,
    graded: graded.length,
  };

  return (
    <div>
      <PageHeader
        title="Student portal"
        description="Submit your work, see grades and feedback, and track your progress."
        action={<Button onClick={() => startNew()}><Send className="mr-2 h-4 w-4" /> New submission</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Awaiting review", value: counts.submitted, icon: Clock },
          { label: "Approved", value: counts.approved, icon: CheckCircle2 },
          { label: "Changes requested", value: counts.needs_changes, icon: RotateCcw },
          { label: "Average grade", value: graded.length ? `${average}%` : "—", icon: Trophy },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-bold">{s.value}</p>
              </div>
              <s.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="open">
        <TabsList className="mb-4 flex w-full flex-wrap justify-start">
          <TabsTrigger value="open">Open assignments</TabsTrigger>
          <TabsTrigger value="submissions">My submissions</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {classQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : classAssignments.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">No class assignments have been posted yet.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {classAssignments.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{c.title}</h3>
                        <Badge variant="outline">{c.subject}</Badge>
                        {submittedFor.has(c.id) && <Badge variant="secondary">Submitted</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.due_date ? `Due ${format(new Date(c.due_date), "MMM d, yyyy")} · ` : ""}
                        Worth {Number(c.max_marks)} marks
                      </p>
                      {c.description && <p className="mt-2 text-sm">{c.description}</p>}
                    </div>
                    <Button variant={submittedFor.has(c.id) ? "outline" : "default"} onClick={() => startNew(c.id)}>
                      <FileUp className="mr-2 h-4 w-4" /> {submittedFor.has(c.id) ? "Submit again" : "Submit"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions">
          {submissionsQuery.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : submissions.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">You haven't submitted anything yet.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {submissions.map((s) => {
                const editable = s.status === "submitted" || s.status === "needs_changes";
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{s.title}</h3>
                        <Badge variant="outline">{s.subject}</Badge>
                        <Badge variant={statusVariant(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                        {s.status === "graded" && s.marks != null && (
                          <Badge>{Number(s.marks)} / {Number(s.max_marks)}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {format(new Date(s.created_at), "MMM d, yyyy")}
                      </p>
                      {s.content && <p className="mt-2 whitespace-pre-wrap text-sm">{s.content}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {s.link_url && (
                          <a className="text-sm text-primary underline" href={s.link_url} target="_blank" rel="noopener noreferrer">
                            Open link
                          </a>
                        )}
                        {s.file_path && (
                          <Button size="sm" variant="outline" onClick={() => openFile(s.file_path!)}>
                            <Download className="mr-2 h-4 w-4" /> {s.file_name ?? "File"}
                          </Button>
                        )}
                      </div>
                      {s.feedback && (
                        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
                          <p className="font-medium">Reviewer feedback</p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.feedback}</p>
                        </div>
                      )}
                      {editable && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit &amp; resubmit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(s)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Withdraw
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Grade trend</CardTitle></CardHeader>
              <CardContent className="h-64">
                {trend.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No graded work yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Average by subject</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {bySubject.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Grades will appear here once your work is marked.</p>
                ) : (
                  bySubject.map((s) => (
                    <div key={s.subject}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{s.subject}</span>
                        <span className="text-muted-foreground">{s.average}% · {s.count} graded</span>
                      </div>
                      <Progress value={s.average} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Status breakdown</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                {Object.entries(counts).map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">{STATUS_LABEL[key] ?? key}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setFile(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit submission" : "New submission"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            {!editing && (
              <>
                <div>
                  <Label>Submit for</Label>
                  <Select
                    value={form.source}
                    onValueChange={(v) => setForm({ ...form, source: v as "class" | "personal" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">A class assignment</SelectItem>
                      <SelectItem value="personal">One of my own assignments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.source === "class" ? (
                  <div>
                    <Label>Class assignment</Label>
                    <Select value={form.classAssignmentId} onValueChange={(v) => setForm({ ...form, classAssignmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
                      <SelectContent>
                        {classAssignments.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title} · {c.subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>My assignment</Label>
                    <Select value={form.assignmentId} onValueChange={(v) => setForm({ ...form, assignmentId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
                      <SelectContent>
                        {(personalQuery.data ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.title} · {a.subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Answer or notes</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                maxLength={5000}
                rows={5}
                placeholder="Type your answer, or describe the attached work…"
              />
            </div>
            <div>
              <Label>Link (Google Docs, Drive, GitHub…)</Label>
              <Input
                type="url"
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label>File (max 20MB)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {editing?.file_name && !file && (
                <p className="mt-1 text-xs text-muted-foreground">Current file: {editing.file_name}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Submitting…" : editing ? "Resubmit" : "Submit for review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
