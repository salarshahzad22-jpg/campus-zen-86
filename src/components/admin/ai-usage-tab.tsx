import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { Bot, MessageSquare, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAiUsageReport } from "@/lib/admin-content.functions";

export function AiUsageTab() {
  const fetchReport = useServerFn(getAiUsageReport);
  const query = useQuery({ queryKey: ["admin-ai-usage"], queryFn: () => fetchReport() });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-destructive">
          {(query.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const r = query.data!;
  const stats = [
    { label: "Questions asked", value: r.totalChatPrompts, icon: MessageSquare },
    { label: "AI replies", value: r.totalAiReplies, icon: Bot },
    { label: "Study plans", value: r.totalStudyPlans, icon: Sparkles },
    { label: "Active students", value: r.activeUsers, icon: Users },
  ];
  const peak = Math.max(1, ...r.days.map((d) => d.chats + d.plans));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-3xl font-bold">{s.value}</p>
              </div>
              <s.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily AI activity (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-2">
            {r.days.map((d) => {
              const total = d.chats + d.plans;
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${(total / peak) * 100}%`, minHeight: total ? 4 : 2 }}
                    title={`${d.day}: ${d.chats} questions, ${d.plans} plans`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(d.day), "d")}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Bars combine chat questions and generated study plans per day.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most active students</CardTitle>
          </CardHeader>
          <CardContent>
            {r.topUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No AI usage yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Questions</TableHead>
                    <TableHead className="text-right">Plans</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.topUsers.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name || "Unnamed student"}</TableCell>
                      <TableCell className="text-right">{u.chats}</TableCell>
                      <TableCell className="text-right">{u.plans}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top study subjects</CardTitle>
          </CardHeader>
          <CardContent>
            {r.topSubjects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No study plans generated yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {r.topSubjects.map((s) => (
                  <Badge key={s.subject} variant="secondary" className="text-sm">
                    {s.subject} · {s.count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
