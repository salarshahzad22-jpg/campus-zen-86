import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, Download, RotateCcw, Trophy } from "lucide-react";

type Submission = {
  id: string;
  user_id: string;
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
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  needs_changes: "Changes requested",
  graded: "Graded",
};

export function SubmissionsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [search, setSearch] = useState("");
  const [grading, setGrading] = useState<Submission | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  const submissionsQuery = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Submission[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["admin-profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
  });

  const nameFor = useMemo(() => {
    const map = new Map((profilesQuery.data ?? []).map((p) => [p.id, p.full_name ?? ""]));
    return (id: string) => map.get(id) || "Student";
  }, [profilesQuery.data]);

  const review = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: string;
      marks?: number | null;
      feedback?: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("submissions")
        .update({
          status: vars.status,
          marks: vars.marks ?? null,
          feedback: vars.feedback ?? null,
          reviewed_by: u.user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast.success("Submission updated");
      setGrading(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("submissions").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Could not open the file");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const items = (submissionsQuery.data ?? []).filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || [s.title, s.subject, nameFor(s.user_id)].join(" ").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Submissions</CardTitle>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, title, subject…"
            className="sm:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Awaiting review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="needs_changes">Changes requested</SelectItem>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {submissionsQuery.isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded bg-muted" />)}</div>
        ) : submissionsQuery.isError ? (
          <p className="py-8 text-center text-sm text-destructive">{(submissionsQuery.error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to review here.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((s) => (
              <div key={s.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{s.title}</p>
                  <Badge variant="outline">{s.subject}</Badge>
                  <Badge variant={s.status === "needs_changes" ? "destructive" : s.status === "graded" ? "default" : "secondary"}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                  {s.marks != null && <Badge>{Number(s.marks)} / {Number(s.max_marks)}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {nameFor(s.user_id)} · {format(new Date(s.created_at), "MMM d, yyyy HH:mm")}
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
                  <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm text-muted-foreground">{s.feedback}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: s.id, status: "approved", marks: s.marks, feedback: s.feedback })}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => {
                      setGrading(s);
                      setMarks(s.marks != null ? String(Number(s.marks)) : "");
                      setFeedback(s.feedback ?? "");
                    }}
                  >
                    <Trophy className="mr-2 h-4 w-4" /> Grade
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={review.isPending}
                    onClick={() => {
                      setGrading(s);
                      setMarks("");
                      setFeedback(s.feedback ?? "");
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Request changes
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!grading} onOpenChange={(v) => !v && setGrading(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {grading?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Marks (out of {grading ? Number(grading.max_marks) : 100})</Label>
              <Input
                type="number"
                min={0}
                max={grading ? Number(grading.max_marks) : 100}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Leave blank when requesting changes"
              />
            </div>
            <div>
              <Label>Feedback</Label>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} maxLength={2000} />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() =>
                grading &&
                review.mutate({ id: grading.id, status: "needs_changes", marks: null, feedback: feedback || null })
              }
            >
              Request changes
            </Button>
            <Button
              disabled={review.isPending}
              onClick={() => {
                if (!grading) return;
                const value = Number(marks);
                if (!marks || Number.isNaN(value) || value < 0 || value > Number(grading.max_marks)) {
                  toast.error(`Enter marks between 0 and ${Number(grading.max_marks)}`);
                  return;
                }
                review.mutate({ id: grading.id, status: "graded", marks: value, feedback: feedback || null });
              }}
            >
              Save grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
