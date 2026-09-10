import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/gpa")({
  head: () => ({
    meta: [
      { title: "GPA & CGPA Calculator — Campus Zen" },
      { name: "description", content: "Add your courses, credit hours and grades to calculate semester GPA and overall CGPA." },
      { property: "og:title", content: "GPA & CGPA Calculator — Campus Zen" },
      { property: "og:description", content: "Calculate semester GPA and overall CGPA from your saved courses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GpaPage,
});

type Course = {
  id: string;
  semester: string;
  name: string;
  credits: number;
  grade_point: number;
  grade_label: string | null;
};

const GRADES = [
  { label: "A", point: 4 },
  { label: "A-", point: 3.7 },
  { label: "B+", point: 3.3 },
  { label: "B", point: 3 },
  { label: "B-", point: 2.7 },
  { label: "C+", point: 2.3 },
  { label: "C", point: 2 },
  { label: "D", point: 1 },
  { label: "F", point: 0 },
];

const empty = { semester: "Semester 1", name: "", credits: "3", grade_label: "A" };

function gpaOf(list: Course[]) {
  const credits = list.reduce((s, c) => s + Number(c.credits), 0);
  if (!credits) return 0;
  const points = list.reduce((s, c) => s + Number(c.credits) * Number(c.grade_point), 0);
  return points / credits;
}

function GpaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("semester")
        .order("created_at");
      if (error) throw error;
      return data as Course[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const credits = Number(form.credits);
      if (!Number.isFinite(credits) || credits <= 0 || credits > 20)
        throw new Error("Credit hours must be between 0 and 20.");
      const grade = GRADES.find((g) => g.label === form.grade_label)!;
      const payload = {
        semester: form.semester.trim(),
        name: form.name.trim(),
        credits,
        grade_point: grade.point,
        grade_label: grade.label,
      };
      if (editing) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("courses").insert({ ...payload, user_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success(editing ? "Course updated" : "Course added");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const semesters = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of data) map.set(c.semester, [...(map.get(c.semester) ?? []), c]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const cgpa = gpaOf(data);
  const totalCredits = data.reduce((s, c) => s + Number(c.credits), 0);

  return (
    <div>
      <PageHeader
        title="GPA & CGPA Calculator"
        description="Add your courses and grades to see each semester's GPA and your overall CGPA."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit course" : "Add course"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div>
                  <Label>Course name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label>Semester</Label>
                  <Input
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    required
                    maxLength={60}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Credit hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="20"
                      value={form.credits}
                      onChange={(e) => setForm({ ...form, credits: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Grade</Label>
                    <Select
                      value={form.grade_label}
                      onValueChange={(v) => setForm({ ...form, grade_label: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((g) => (
                          <SelectItem key={g.label} value={g.label}>
                            {g.label} ({g.point.toFixed(1)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending || !form.name.trim()}>
                    {save.isPending ? "Saving…" : "Save course"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Overall CGPA</p>
            <p className="mt-1 text-3xl font-bold">{cgpa.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total credit hours</p>
            <p className="mt-1 text-3xl font-bold">{totalCredits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Courses</p>
            <p className="mt-1 text-3xl font-bold">{data.length}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No courses yet. Add a course to start calculating your GPA.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {semesters.map(([semester, list]) => (
            <Card key={semester}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">{semester}</CardTitle>
                <span className="text-sm font-medium">GPA {gpaOf(list).toFixed(2)}</span>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Grade</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{Number(c.credits)}</TableCell>
                        <TableCell className="text-right">
                          {c.grade_label} ({Number(c.grade_point).toFixed(1)})
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(c);
                              setForm({
                                semester: c.semester,
                                name: c.name,
                                credits: String(Number(c.credits)),
                                grade_label: c.grade_label ?? "A",
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => del.mutate(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
