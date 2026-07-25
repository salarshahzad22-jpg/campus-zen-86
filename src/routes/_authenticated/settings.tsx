import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { applyTheme, getTheme } from "@/lib/theme";
import { LogOut, Moon, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Campus Helper AI" }] }),
  component: SettingsPage,
});

const NOTIF_KEY = "chai_notifications";

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    university: "",
    department: "",
    semester: "",
    avatar_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [dark, setDark] = useState(false);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    setDark(getTheme() === "dark");
    setNotifications(localStorage.getItem(NOTIF_KEY) !== "off");
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, university, department, semester, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      if (p) {
        setForm({
          full_name: p.full_name ?? "",
          university: p.university ?? "",
          department: p.department ?? "",
          semester: p.semester ?? "",
          avatar_url: p.avatar_url ?? "",
        });
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").upsert({ id: u.user!.id, ...form });
      if (error) throw error;
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  function toggleDark(v: boolean) {
    setDark(v);
    applyTheme(v ? "dark" : "light");
  }

  function toggleNotifications(v: boolean) {
    setNotifications(v);
    localStorage.setItem(NOTIF_KEY, v ? "on" : "off");
    toast.success(v ? "Notifications enabled" : "Notifications disabled");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (form.full_name || email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your profile and preferences." />

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={form.avatar_url} alt={form.full_name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label>Profile picture URL</Label>
              <Input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>University</Label>
              <Input value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} />
            </div>
          </div>
          <div>
            <Label>Semester</Label>
            <Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="e.g. Fall 2026" maxLength={40} />
          </div>
          <div className="pt-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Dark mode</p>
                <p className="text-sm text-muted-foreground">Use a darker theme.</p>
              </div>
            </div>
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-muted-foreground">Get toast alerts for updates.</p>
              </div>
            </div>
            <Switch checked={notifications} onCheckedChange={toggleNotifications} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
