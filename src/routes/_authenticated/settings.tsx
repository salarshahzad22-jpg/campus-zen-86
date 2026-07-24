import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Campus Helper AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      setFullName(p?.full_name ?? "");
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").upsert({ id: u.user!.id, full_name: fullName });
      if (error) throw error;
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account." />
      <Card className="max-w-xl">
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
