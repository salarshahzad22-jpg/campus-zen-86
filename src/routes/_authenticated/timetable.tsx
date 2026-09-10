import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({
    meta: [
      { title: "Weekly Timetable — Campus Zen" },
      { name: "description", content: "Plan your weekly class schedule with subjects, teachers, rooms and times." },
      { property: "og:title", content: "Weekly Timetable — Campus Zen" },
      { property: "og:description", content: "Plan your weekly class schedule in Campus Zen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimetablePage,
});

type Entry = {
  id: string;
  subject: string;
  teacher: string | null;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const empty = { subject: "", teacher: "", room: "", day_of_week: "1", start_time: "09:00", end_time: "10:00" };

function hhmm(t: string) {
  return t.slice(0, 5);
}

function TimetablePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_entries")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data as Entry[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.end_time <= form.start_time) throw new Error("End time must be after start time.");
      const payload = {
        subject: form.subject.trim(),
        teacher: form.teacher.trim() || null,
        room: form.room.trim() || null,
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
      };
      if (editing) {
        const { error } = await supabase.from("timetable_entries").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("timetable_entries")
          .insert({ ...payload, user_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success(editing ? "Class updated" : "Class added");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Class removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(e: Entry) {
    setEditing(e);
    setForm({
      subject: e.subject,
      teacher: e.teacher ?? "",
      room: e.room ?? "",
      day_of_week: String(e.day_of_week),
      start_time: hhmm(e.start_time),
      end_time: hhmm(e.end_time),
    });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Weekly Timetable"
        description="Your class schedule at a glance."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit class" : "Add class"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Teacher</Label>
                    <Input
                      value={form.teacher}
                      onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label>Room</Label>
                    <Input
                      value={form.room}
                      onChange={(e) => setForm({ ...form, room: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                </div>
                <div>
                  <Label>Day</Label>
                  <Select
                    value={form.day_of_week}
                    onValueChange={(v) => setForm({ ...form, day_of_week: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i + 1)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Starts</Label>
                    <Input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Ends</Label>
                    <Input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending || !form.subject.trim()}>
                    {save.isPending ? "Saving…" : "Save class"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No classes yet. Add your first class to build your weekly schedule.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((day, i) => {
            const items = data.filter((e) => e.day_of_week === i + 1);
            if (items.length === 0) return null;
            return (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{day}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((e) => (
                    <div key={e.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {[e.teacher, e.room].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => del.mutate(e.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Badge variant="secondary" className="mt-2 gap-1">
                        <Clock className="h-3 w-3" />
                        {hhmm(e.start_time)}–{hhmm(e.end_time)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
