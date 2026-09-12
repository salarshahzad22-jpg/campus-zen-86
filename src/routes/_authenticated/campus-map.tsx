import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/campus-map")({
  head: () => ({
    meta: [
      { title: "Campus Map — Campus Zen" },
      { name: "description", content: "Find libraries, labs, hostels and offices around campus with directions." },
      { property: "og:title", content: "Campus Map — Campus Zen" },
      { property: "og:description", content: "Browse campus places and open directions in one tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampusMapPage,
});

type Place = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
};

const empty = { name: "", category: "general", description: "", latitude: "", longitude: "" };

function CampusMapPage() {
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [form, setForm] = useState(empty);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["campus-places"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campus_places").select("*").order("name");
      if (error) throw error;
      return data as Place[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const lat = form.latitude.trim() ? Number(form.latitude) : null;
      const lng = form.longitude.trim() ? Number(form.longitude) : null;
      if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
        throw new Error("Latitude must be between -90 and 90.");
      if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
        throw new Error("Longitude must be between -180 and 180.");
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || "general",
        description: form.description.trim() || null,
        latitude: lat,
        longitude: lng,
      };
      if (editing) {
        const { error } = await supabase.from("campus_places").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campus_places").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campus-places"] });
      toast.success(editing ? "Place updated" : "Place added");
      setOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campus_places").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campus-places"] });
      toast.success("Place removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      [p.name, p.category, p.description].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [data, search]);

  const located = filtered.filter((p) => p.latitude !== null && p.longitude !== null);
  const selected = located.find((p) => p.id === selectedId) ?? located[0] ?? null;

  const mapSrc = selected
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude! - 0.004}%2C${
        selected.latitude! - 0.003
      }%2C${selected.longitude! + 0.004}%2C${selected.latitude! + 0.003}&layer=mapnik&marker=${
        selected.latitude
      }%2C${selected.longitude}`
    : null;

  return (
    <div>
      <PageHeader
        title="Campus Map"
        description="Key places around campus, with directions one tap away."
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
                  <Plus className="mr-2 h-4 w-4" /> Add place
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit place" : "Add place"}</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save.mutate();
                  }}
                >
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      maxLength={60}
                      placeholder="library, lab, hostel, cafeteria…"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      maxLength={1000}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Latitude</Label>
                      <Input
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                        placeholder="31.5204"
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                        placeholder="74.3587"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={save.isPending || !form.name.trim()}>
                      {save.isPending ? "Saving…" : "Save place"}
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
          placeholder="Search places…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {mapSrc && (
        <Card className="mb-4 overflow-hidden">
          <iframe
            title={`Map of ${selected!.name}`}
            src={mapSrc}
            className="h-72 w-full border-0"
            loading="lazy"
          />
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{selected!.name}</p>
              <p className="text-xs text-muted-foreground">
                {selected!.latitude}, {selected!.longitude}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selected!.latitude},${selected!.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {data.length === 0
              ? "No campus places yet. An administrator can add them here."
              : "No places match that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className={p.id === selected?.id ? "border-primary" : undefined}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {p.category}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setForm({
                            name: p.name,
                            category: p.category,
                            description: p.description ?? "",
                            latitude: p.latitude?.toString() ?? "",
                            longitude: p.longitude?.toString() ?? "",
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
                        onClick={() => del.mutate(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
                {p.latitude !== null && p.longitude !== null && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <MapPin className="mr-2 h-4 w-4" /> Show on map
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
