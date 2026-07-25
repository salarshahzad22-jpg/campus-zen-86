import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Bot, Send, Trash2, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendCampusChatMessage, clearCampusChat } from "@/lib/campus-chat.functions";

export const Route = createFileRoute("/_authenticated/ask-ai")({
  head: () => ({
    meta: [
      { title: "Ask Campus AI — Chat with your study assistant" },
      { name: "description", content: "Chat with Campus AI about studies, assignments, exams, and campus life." },
    ],
  }),
  component: AskAI,
});

type ChatRow = { id: string; role: "user" | "assistant"; content: string; created_at: string };

const WELCOME: ChatRow = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm Campus AI. Ask me anything about your studies, assignments, exams, or campus life.",
  created_at: "",
};

function AskAI() {
  const qc = useQueryClient();
  const send = useServerFn(sendCampusChatMessage);
  const clear = useServerFn(clearCampusChat);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatRow[];
    },
  });

  const sendMut = useMutation({
    mutationFn: async (message: string) => send({ data: { message } }),
    onMutate: async (message) => {
      await qc.cancelQueries({ queryKey: ["chat_messages"] });
      const prev = qc.getQueryData<ChatRow[]>(["chat_messages"]) ?? [];
      const optimistic: ChatRow = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ChatRow[]>(["chat_messages"], [...prev, optimistic]);
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chat_messages"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["chat_messages"] }),
  });

  const clearMut = useMutation({
    mutationFn: async () => clear({}),
    onSuccess: () => {
      qc.setQueryData(["chat_messages"], []);
      toast.success("Chat cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayed: ChatRow[] = messages.length > 0 ? messages : [WELCOME];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sendMut.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sendMut.isPending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMut.isPending) return;
    setInput("");
    sendMut.mutate(text);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Ask Campus AI"
          description="Your always-on study buddy — ask about assignments, exams, or campus life."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearMut.mutate()}
          disabled={clearMut.isPending || messages.length === 0}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Clear chat
        </Button>
      </div>

      <Card className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading chat…
            </div>
          ) : (
            displayed.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {sendMut.isPending && (
            <div className="flex gap-3">
              <Avatar role="assistant" />
              <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t bg-background p-3 md:p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Campus AI anything…"
              disabled={sendMut.isPending}
              maxLength={4000}
              autoFocus
            />
            <Button type="submit" disabled={!input.trim() || sendMut.isPending}>
              {sendMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Send</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full",
        isUser ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground",
      )}
    >
      {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatRow }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={message.role} />
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  );
}
