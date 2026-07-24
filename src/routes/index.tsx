import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, CalendarCheck, ClipboardList, GraduationCap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Helper AI — Your student command center" },
      {
        name: "description",
        content:
          "Track assignments, attendance and exams, save study resources, and get AI-generated study plans in one place.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ClipboardList, title: "Assignments", desc: "Track every task with priorities, due dates and status." },
  { icon: CalendarCheck, title: "Attendance", desc: "Log classes and monitor your attendance streak." },
  { icon: GraduationCap, title: "Exam Planner", desc: "Plan preparation and never miss an exam again." },
  { icon: BookOpen, title: "Resources", desc: "Save notes, links and files organized by subject." },
  { icon: Brain, title: "AI Study Assistant", desc: "Generate goals, action plans and revision tips instantly." },
  { icon: Sparkles, title: "Insights", desc: "See upcoming deadlines and stats on a clean dashboard." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </span>
            Campus Helper AI
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Built for university students
        </div>
        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
          Study smarter with your{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            campus command center
          </span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          Manage assignments, track attendance, plan exams and save resources — plus an AI helper
          that turns your deadlines into a clear study plan.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth">I already have an account</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Built with Lovable · Campus Helper AI
      </footer>
    </div>
  );
}
