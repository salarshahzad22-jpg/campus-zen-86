import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { format } from "date-fns";
import { Users, ClipboardList, BookOpen, MessageSquare, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-profile";
import { listAdminUsers, setUserRole, deleteUserAsAdmin, getAdminAnalytics } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Campus Zen" },
      { name: "description", content: "Manage Campus Zen students, roles and platform analytics." },
      { property: "og:title", content: "Admin panel — Campus Zen" },
      { property: "og:description", content: "Manage Campus Zen students, roles and platform analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();
  const [search, setSearch] = useState("");

  const fetchUsers = useServerFn(listAdminUsers);
  const fetchAnalytics = useServerFn(getAdminAnalytics);
  const mutateRole = useServerFn(setUserRole);
  const removeUser = useServerFn(deleteUserAsAdmin);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAnalytics(),
    enabled: isAdmin,
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "moderator" | "student"; grant: boolean }) =>
      mutateRole({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.success("User deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.university.toLowerCase().includes(q),
    );
  }, [users, search]);

  if (roleLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Admin panel" description="Restricted area." />
        <Card>
          <CardContent className="p-10 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">You don't have admin access</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask an existing administrator to grant you the admin role.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const counts = statsQuery.data?.counts ?? {};
  const stats = [
    { label: "Students", value: counts.profiles ?? 0, icon: Users },
    { label: "Assignments", value: counts.assignments ?? 0, icon: ClipboardList },
    { label: "Resources", value: counts.resources ?? 0, icon: BookOpen },
    { label: "AI messages", value: counts.chat_messages ?? 0, icon: MessageSquare },
  ];

  return (
    <div>
      <PageHeader title="Admin panel" description="Manage students, roles and platform activity." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-bold">
                  {statsQuery.isLoading ? "—" : s.value}
                </p>
              </div>
              <s.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="flex items-center gap-3 p-5">
          <UserPlus className="h-5 w-5 text-accent" />
          <p className="text-sm">
            <span className="font-medium">{statsQuery.data?.newUsersLast7Days ?? 0}</span> new students joined
            in the last 7 days.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Users</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, university…"
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : usersQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              {(usersQuery.error as Error).message}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No users match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">University</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const isUserAdmin = u.roles.includes("admin");
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium">{u.fullName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          {!u.verified && (
                            <Badge variant="outline" className="mt-1">Unverified</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {u.university || "—"}
                          {u.department ? ` · ${u.department}` : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <Badge variant="secondary">student</Badge>
                            ) : (
                              u.roles.map((r) => (
                                <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {format(new Date(u.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={roleMutation.isPending}
                              onClick={() =>
                                roleMutation.mutate({ userId: u.id, role: "admin", grant: !isUserAdmin })
                              }
                            >
                              {isUserAdmin ? "Revoke admin" : "Make admin"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the account and all of their study data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)}>
                                    Delete user
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
