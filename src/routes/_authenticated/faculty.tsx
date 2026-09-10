import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MapPin, Plus, Pencil, Trash2, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin, initialsFrom } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty Directory — Campus Zen" },
      { name: "description", content: "Find teachers by name or department with office, email and office-hours details." },
      { property: "og:title", content: "Faculty Directory — Campus Zen" },
      { property: "og:description", content: "Browse faculty contacts, offices and office hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacultyPage,
});

type Faculty = {
  id: string;
  full_name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  office: string | null;
  office_hours: string | null;
};

const empty = {
  full_name: "",
  title: "",
  department: "",
  email: "",
  phone: "",
  office: "",
  office_hours: "",
};

function FacultyPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [form, setForm] = useState(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["faculty"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faculty").select("*").order("full_name");
      if (error) throw error;
      return data as Faculty[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        title: form.title.trim() || null,
        department: form.department.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        office: form.office.trim() || null,
        office_hours: form.office_hours.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("faculty").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("faculty").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculty"] });
      toast.success(editing ? "Faculty member updated" : "Faculty member added");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faculty").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculty"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((f) =>
      [f.full_name, f.title, f.department, f.office].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        title="Faculty Directory"
        description="Contact details and office hours for teaching staff."
        action={
          isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add faculty
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit faculty member" : "Add faculty member"}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate();
                  }}
                >
                  <div>
                    <Label>Full name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        maxLength={120}
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        maxLength={120}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        maxLength={180}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        maxLength={40}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Office</Label>
                      <Input
                        value={form.office}
                        onChange={(e) => setForm({ ...form, office: e.target.value })}
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <Label>Office hours</Label>
                      <Input
                        value={form.office_hours}
                        onChange={(e) => setForm({ ...form, office_hours: e.target.value })}
                        maxLength={120}
                        placeholder="Mon–Wed, 2–4 PM"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={save.isPending || !form.full_name.trim()}>
                      {save.isPending ? "Saving…" : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or department…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {data.length === 0
              ? "The directory is empty. An administrator can add faculty members here."
              : "No one matches that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initialsFrom(f.full_name, f.email ?? "")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{f.full_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{f.title || "Faculty"}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(f);
                          setForm({
                            full_name: f.full_name,
                            title: f.title ?? "",
                            department: f.department ?? "",
                            email: f.email ?? "",
                            phone: f.phone ?? "",
                            office: f.office ?? "",
                            office_hours: f.office_hours ?? "",
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
                        onClick={() => del.mutate(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {f.department && (
                  <Badge variant="secondary" className="mt-3">
                    {f.department}
                  </Badge>
                )}

                <div className="mt-3 space-y-1 text-sm">
                  {f.email && (
                    <a
                      href={`mailto:${f.email}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" /> <span className="truncate">{f.email}</span>
                    </a>
                  )}
                  {f.phone && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> {f.phone}
                    </p>
                  )}
                  {f.office && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {f.office}
                    </p>
                  )}
                  {f.office_hours && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" /> {f.office_hours}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
