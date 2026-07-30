import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { applyTheme, getTheme } from "@/lib/theme";
import { LogOut, Moon, Bell, Upload, KeyRound, Trash2, MailCheck, ShieldAlert } from "lucide-react";
import { useProfile, initialsFrom, resolveAvatarUrl } from "@/hooks/use-profile";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Campus Zen" },
      { name: "description", content: "Manage your Campus Zen profile, security and app preferences." },
      { property: "og:title", content: "Settings — Campus Zen" },
      { property: "og:description", content: "Manage your Campus Zen profile, security and app preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const NOTIF_KEY = "chai_notifications";

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    university: "",
    department: "",
    semester: "",
    phone: "",
    bio: "",
  });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dark, setDark] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDark(getTheme() === "dark");
    setNotifications(localStorage.getItem(NOTIF_KEY) !== "off");
  }, []);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name,
      university: profile.university,
      department: profile.department,
      semester: profile.semester,
      phone: profile.phone,
      bio: profile.bio,
    });
    setAvatarUrl(profile.avatarUrl);
    setAvatarPath(profile.avatar_path);
  }, [profile]);

  async function save() {
    if (!profile) return;
    if (form.phone && !/^[+\d][\d\s()-]{5,19}$/.test(form.phone.trim())) {
      toast.error("Enter a valid phone number.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: profile.id,
        full_name: form.full_name.trim().slice(0, 100),
        university: form.university.trim().slice(0, 120),
        department: form.department.trim().slice(0, 120),
        semester: form.semester.trim().slice(0, 40),
        phone: form.phone.trim().slice(0, 20),
        bio: form.bio.trim().slice(0, 300),
        avatar_url: avatarPath,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["current-profile"] });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3 MB.");

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;

      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({ id: profile.id, avatar_url: path });
      if (pErr) throw pErr;

      if (avatarPath && !/^https?:\/\//.test(avatarPath)) {
        await supabase.storage.from("avatars").remove([avatarPath]);
      }

      setAvatarPath(path);
      setAvatarUrl(await resolveAvatarUrl(path));
      await qc.invalidateQueries({ queryKey: ["current-profile"] });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) return toast.error("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function resendVerification() {
    if (!profile) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: profile.email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
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

  async function deleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
      setDeleting(false);
    }
  }

  const initials = initialsFrom(form.full_name, profile?.email ?? "");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your profile, security and preferences." />

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl} alt={form.full_name || "Profile picture"} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
                  <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload picture"}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 3 MB.</p>
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={profile?.email ?? ""} disabled />
                  {profile?.emailVerified ? (
                    <Badge variant="secondary" className="shrink-0">Verified</Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0">Unverified</Badge>
                  )}
                </div>
                {!profile?.emailVerified && (
                  <Button variant="link" className="h-auto p-0 mt-1 text-sm" onClick={resendVerification}>
                    <MailCheck className="mr-1 h-3.5 w-3.5" /> Resend verification email
                  </Button>
                )}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Semester</Label>
                  <Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="e.g. Fall 2026" maxLength={40} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" maxLength={20} />
                </div>
              </div>
              <div>
                <Label>Bio</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  maxLength={300}
                  rows={3}
                  placeholder="A short line about you and what you're studying."
                />
                <p className="mt-1 text-xs text-muted-foreground">{form.bio.length}/300</p>
              </div>
              <div className="pt-2">
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} maxLength={72} />
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={72} />
            </div>
          </div>
          <Button variant="outline" onClick={changePassword} disabled={changingPassword || !newPassword}>
            <KeyRound className="mr-2 h-4 w-4" />
            {changingPassword ? "Updating…" : "Change password"}
          </Button>
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
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" /> Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your profile, assignments, attendance, exams, resources and
                  chat history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount}>Yes, delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
