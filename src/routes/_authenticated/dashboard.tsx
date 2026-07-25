import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { format, isPast, differenceInDays } from "date-fns";
import { ClipboardList, GraduationCap, CalendarCheck, BookOpen, ArrowRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Campus Helper AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [a, at, e, r] = await Promise.all([
        supabase.from("assignments").select("*").order("due_date"),
        supabase.from("attendance").select("*"),
        supabase.from("exams").select("*").order("exam_date"),
        supabase.from("resources").select("id"),
      ]);
      return {
        assignments: a.data ?? [],
        attendance: at.data ?? [],
        exams: e.data ?? [],
        resources: r.data ?? [],
      };
    },
  });

  const assignments = data?.assignments ?? [];
  const attendance = data?.attendance ?? [];
  const exams = data?.exams ?? [];

  const pendingAssignments = assignments.filter((a) => a.status !== "done");
  const upcomingExams = exams.filter((e) => !isPast(new Date(e.exam_date)));
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const attendancePct = attendance.length
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  const stats = [
    { label: "Pending assignments", value: pendingAssignments.length, icon: ClipboardList, href: "/assignments", color: "text-primary" },
    { label: "Upcoming exams", value: upcomingExams.length, icon: GraduationCap, href: "/exams", color: "text-accent" },
    { label: "Attendance %", value: `${attendancePct}%`, icon: CalendarCheck, href: "/attendance", color: "text-success" },
    { label: "Resources saved", value: data?.resources.length ?? 0, icon: BookOpen, href: "/resources", color: "text-primary" },
  ];

  const upcoming = [...pendingAssignments]
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Welcome back 👋"
        description="Here's what's coming up. Stay on top of your semester."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-3xl font-bold">{s.value}</p>
                  </div>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Ask Campus AI</h3>
              <p className="text-sm text-muted-foreground">
                Chat with your AI study buddy about assignments, exams, and campus life.
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="w-full md:w-auto">
            <Link to="/ask-ai">Open AI Assistant <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming deadlines</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/assignments">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due — nice work!</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a) => {
                  const days = differenceInDays(new Date(a.due_date), new Date());
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.subject} · {format(new Date(a.due_date), "MMM d, yyyy")}</p>
                      </div>
                      <Badge variant={days < 0 ? "destructive" : days <= 2 ? "default" : "secondary"}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d left`}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Next exams</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/exams">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exams scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingExams.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.subject} · {format(new Date(e.exam_date), "MMM d, yyyy")}</p>
                    </div>
                    <Badge variant="outline">{e.prep_status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
