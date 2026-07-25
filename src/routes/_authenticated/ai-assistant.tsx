import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, CheckCircle2, ListChecks, Sparkles, Target, History, Copy } from "lucide-react";
import { toast } from "sonner";
import { generateStudyPlan, type StudyPlan } from "@/lib/ai-study.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({ meta: [{ title: "AI Study Assistant — Campus Helper AI" }] }),
  component: AIAssistant,
});

function AIAssistant() {
  const qc = useQueryClient();
  const gen = useServerFn(generateStudyPlan);
  const [form, setForm] = useState({ subject: "", deadline: "", task_type: "assignment", progress: "" });
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  const mutate = useMutation({
    mutationFn: async () => gen({ data: form }),
    onSuccess: (p) => {
      setPlan(p);
      qc.invalidateQueries({ queryKey: ["ai_history"] });
      toast.success("Study plan generated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["ai_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="AI Study Assistant"
        description="Get a personalized study plan in seconds."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Generate a plan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); mutate.mutate(); }} className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={200} placeholder="e.g., Organic Chemistry" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Deadline</Label>
                  <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div>
                  <Label>Task type</Label>
                  <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="exam">Exam prep</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="reading">Reading</SelectItem>
                      <SelectItem value="revision">Revision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Current progress</Label>
                <Textarea
                  rows={3}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: e.target.value })}
                  maxLength={1000}
                  placeholder="e.g., Read chapter 1, still stuck on reactions"
                />
              </div>
              <Button type="submit" className="w-full" disabled={mutate.isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                {mutate.isPending ? "Generating…" : "Generate study plan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {plan ? (
            <Card className="border-primary/30">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-accent" /> Your goal</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const text = `Goal: ${plan.goal}\n\nAction plan:\n${plan.action_plan.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nDaily checklist:\n${plan.daily_checklist.map((c) => `- ${c}`).join("\n")}\n\nRevision tips:\n${plan.revision_tips.map((t) => `- ${t}`).join("\n")}`;
                    navigator.clipboard.writeText(text);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-lg font-medium">{plan.goal}</p>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                    <ListChecks className="h-4 w-4" /> 3-Step action plan
                  </h4>
                  <ol className="space-y-2">
                    {plan.action_plan.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" /> Daily checklist
                  </h4>
                  <ul className="space-y-1.5">
                    {plan.daily_checklist.map((c, i) => (
                      <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> <span>{c}</span></li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                    <Sparkles className="h-4 w-4" /> Revision tips
                  </h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {plan.revision_tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">
                <Brain className="mx-auto h-10 w-10 opacity-40" />
                <p className="mt-3">Your plan will appear here.</p>
              </CardContent>
            </Card>
          )}

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Recent plans</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between border-b pb-2 last:border-0 last:pb-0">
                      <span className="truncate">{h.subject} · {h.task_type}</span>
                      <span className="text-muted-foreground text-xs shrink-0 ml-2">{format(new Date(h.created_at), "MMM d")}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
