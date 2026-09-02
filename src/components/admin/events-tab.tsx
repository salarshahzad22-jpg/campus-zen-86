import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listEvents, saveEvent, deleteEvent } from "@/lib/admin-content.functions";

type CampusEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category: string;
  starts_at: string;
  ends_at: string | null;
  published: boolean;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const empty = {
  id: undefined as string | undefined,
  title: "",
  description: "",
  location: "",
  category: "general",
  starts_at: "",
  ends_at: "",
  published: true,
};

export function EventsTab() {
  const qc = useQueryClient();
  const fetchEvents = useServerFn(listEvents);
  const persist = useServerFn(saveEvent);
  const remove = useServerFn(deleteEvent);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const query = useQuery({ queryKey: ["admin-events"], queryFn: () => fetchEvents() });

  const saveMutation = useMutation({
    mutationFn: () => persist({ data: { ...form, ends_at: form.ends_at || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setOpen(false);
      toast.success(form.id ? "Event updated" : "Event created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const events = (query.data ?? []) as CampusEvent[];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Events</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setForm({ ...empty, starts_at: toLocalInput(new Date().toISOString()) });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New event
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-8 text-center text-sm text-destructive">{(query.error as Error).message}</p>
        ) : events.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No events scheduled yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{ev.title}</p>
                    <Badge variant="secondary">{ev.category}</Badge>
                    {!ev.published && <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(new Date(ev.starts_at), "EEE, MMM d yyyy · p")}
                    {ev.ends_at ? ` – ${format(new Date(ev.ends_at), "p")}` : ""}
                  </p>
                  {ev.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {ev.location}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setForm({
                        id: ev.id,
                        title: ev.title,
                        description: ev.description ?? "",
                        location: ev.location ?? "",
                        category: ev.category,
                        starts_at: toLocalInput(ev.starts_at),
                        ends_at: toLocalInput(ev.ends_at),
                        published: ev.published,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(ev.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit event" : "New event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ev-title">Title</Label>
              <Input
                id="ev-title"
                value={form.title}
                maxLength={160}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ev-start">Starts</Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ev-end">Ends (optional)</Label>
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ev-location">Location</Label>
                <Input
                  id="ev-location"
                  value={form.location}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ev-category">Category</Label>
                <Input
                  id="ev-category"
                  value={form.category}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea
                id="ev-desc"
                rows={4}
                value={form.description}
                maxLength={5000}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Visible to students</span>
              <Switch
                checked={form.published}
                onCheckedChange={(v) => setForm({ ...form, published: v })}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saveMutation.isPending || !form.title.trim() || !form.starts_at}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
