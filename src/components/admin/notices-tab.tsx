import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
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
import { listNotices, saveNotice, deleteNotice } from "@/lib/admin-content.functions";

type Notice = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
};

const empty = { id: undefined as string | undefined, title: "", body: "", published: true };

export function NoticesTab() {
  const qc = useQueryClient();
  const fetchNotices = useServerFn(listNotices);
  const persist = useServerFn(saveNotice);
  const remove = useServerFn(deleteNotice);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const query = useQuery({ queryKey: ["admin-notices"], queryFn: () => fetchNotices() });

  const saveMutation = useMutation({
    mutationFn: () => persist({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      setOpen(false);
      toast.success(form.id ? "Notice updated" : "Notice published");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notices"] });
      toast.success("Notice deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notices = (query.data ?? []) as Notice[];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Notices</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New notice
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
        ) : notices.length === 0 ? (
          <div className="py-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No notices yet. Publish your first one.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {notices.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{n.title}</p>
                    <Badge variant={n.published ? "default" : "secondary"}>
                      {n.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(n.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setForm({ id: n.id, title: n.title, body: n.body, published: n.published });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(n.id)}
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
            <DialogTitle>{form.id ? "Edit notice" : "New notice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                value={form.title}
                maxLength={160}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notice-body">Message</Label>
              <Textarea
                id="notice-body"
                rows={5}
                value={form.body}
                maxLength={5000}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
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
              disabled={saveMutation.isPending || !form.title.trim() || !form.body.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
