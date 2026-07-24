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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Campus Helper AI" }] }),
  component: AttendancePage,
});

type Row = { id: string; subject: string; date: string; status: string; note: string | null };

const empty = { subject: "", date: new Date().toISOString().slice(0, 10), status: "present", note: "" };

function AttendancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("attendance").insert({ ...form, note: form.note || null, user_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Attendance logged");
      setOpen(false); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const filtered = useMemo(
    () => data.filter((r) => [r.subject, r.note ?? ""].join(" ").toLowerCase().includes(search.toLowerCase())),
    [data, search]
  );

  const bySubject = useMemo(() => {
    const map: Record<string, { total: number; present: number }> = {};
    for (const r of data) {
      map[r.subject] ??= { total: 0, present: 0 };
      map[r.subject].total++;
      if (r.status === "present") map[r.subject].present++;
    }
    return map;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Log classes and track your attendance percentage."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Log class</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log attendance</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={100} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="excused">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} />
                </div>
                <DialogFooter><Button type="submit" disabled={add.isPending}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {Object.keys(bySubject).length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(bySubject).map(([subject, s]) => {
            const pct = Math.round((s.present / s.total) * 100);
            return (
              <Card key={subject}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground truncate">{subject}</p>
                  <p className="mt-1 text-2xl font-bold">{pct}%</p>
                  <p className="text-xs text-muted-foreground">{s.present}/{s.total} classes</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{r.subject}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.note}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
