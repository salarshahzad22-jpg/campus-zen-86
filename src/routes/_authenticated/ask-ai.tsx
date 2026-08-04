import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Bot,
  Send,
  Trash2,
  User as UserIcon,
  Loader2,
  Mic,
  MicOff,
  Copy,
  Check,
  Share2,
  Star,
  Sparkle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  sendCampusChatMessage,
  clearCampusChat,
  toggleChatFavorite,
} from "@/lib/campus-chat.functions";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import { useVoiceInput } from "@/hooks/use-voice-input";
import "highlight.js/styles/github-dark.css";

export const Route = createFileRoute("/_authenticated/ask-ai")({
  head: () => ({
    meta: [
      { title: "Ask Campus AI — Chat with your study assistant" },
      {
        name: "description",
        content:
          "Chat with Campus AI about studies, assignments, exams, and campus life. Voice input, markdown answers, and saved favorites.",
      },
      { property: "og:title", content: "Ask Campus AI — Chat with your study assistant" },
      {
        property: "og:description",
        content: "Voice-enabled AI study assistant for assignments, exams, and campus life.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ask Campus AI" },
      {
        name: "twitter:description",
        content: "Voice-enabled AI study assistant for assignments, exams, and campus life.",
      },
    ],
  }),
  component: AskAI,
});

type ChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_favorite: boolean;
};

const WELCOME =
  "Hi! I'm **Campus AI** — ask me anything about your studies, assignments, exams, or campus life.";

const SUGGESTIONS = [
  "Make me a 7-day revision plan for my next exam",
  "Summarise the key points of photosynthesis",
  "How do I stay consistent with attendance?",
  "Explain Big-O notation with a code example",
];

function AskAI() {
  const qc = useQueryClient();
  const send = useServerFn(sendCampusChatMessage);
  const clear = useServerFn(clearCampusChat);
  const favorite = useServerFn(toggleChatFavorite);
  const [input, setInput] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput((text) => setInput(text));
  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at, is_favorite")
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
        is_favorite: false,
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

  const favMut = useMutation({
    mutationFn: async (v: { id: string; is_favorite: boolean }) => favorite({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["chat_messages"] });
      const prev = qc.getQueryData<ChatRow[]>(["chat_messages"]) ?? [];
      qc.setQueryData<ChatRow[]>(
        ["chat_messages"],
        prev.map((m) => (m.id === v.id ? { ...m, is_favorite: v.is_favorite } : m)),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["chat_messages"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["chat_messages"] }),
  });

  const favoriteCount = messages.filter((m) => m.is_favorite).length;
  const displayed = useMemo(
    () => (onlyFavorites ? messages.filter((m) => m.is_favorite) : messages),
    [messages, onlyFavorites],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayed, sendMut.isPending]);

  useEffect(() => {
    if (!sendMut.isPending) inputRef.current?.focus();
  }, [sendMut.isPending]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || sendMut.isPending) return;
    setInput("");
    if (voice.listening) voice.stop();
    setOnlyFavorites(false);
    sendMut.mutate(value);
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Ask Campus AI"
          description="Your always-on study buddy — ask about assignments, exams, or campus life."
        />
        <div className="flex gap-2">
          <Button
            variant={onlyFavorites ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyFavorites((v) => !v)}
            disabled={favoriteCount === 0 && !onlyFavorites}
          >
            <Star className={cn("mr-2 h-4 w-4", onlyFavorites && "fill-current")} />
            Favorites{favoriteCount > 0 ? ` (${favoriteCount})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMut.mutate()}
            disabled={clearMut.isPending || messages.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear chat
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading chat…
            </div>
          ) : displayed.length === 0 && onlyFavorites ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No saved answers yet — tap the star on a reply to keep it here.
            </p>
          ) : (
            <>
              {messages.length === 0 && (
                <MessageBubble
                  message={{
                    id: "welcome",
                    role: "assistant",
                    content: WELCOME,
                    created_at: "",
                    is_favorite: false,
                  }}
                />
              )}
              {displayed.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onToggleFavorite={
                    m.id.startsWith("optimistic")
                      ? undefined
                      : () => favMut.mutate({ id: m.id, is_favorite: !m.is_favorite })
                  }
                />
              ))}
            </>
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

        {messages.length === 0 && !isLoading && (
          <div className="flex flex-wrap gap-2 border-t px-4 pt-3 md:px-6">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/10"
              >
                <Sparkle className="mr-1 inline h-3 w-3 text-primary" />
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="bg-background p-3 md:p-4"
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              placeholder={voice.listening ? "Listening…" : "Ask Campus AI anything…"}
              disabled={sendMut.isPending}
              maxLength={4000}
              rows={1}
              className="max-h-40 min-h-[2.75rem] resize-none"
              autoFocus
            />
            {voice.supported && (
              <Button
                type="button"
                variant={voice.listening ? "default" : "outline"}
                size="icon"
                aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                disabled={sendMut.isPending}
                className={cn(voice.listening && "animate-pulse")}
              >
                {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
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

function MessageBubble({
  message,
  onToggleFavorite,
}: {
  message: ChatRow;
  onToggleFavorite?: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Campus AI", text: message.content });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  return (
    <div
      className={cn(
        "group flex animate-in gap-3 fade-in slide-in-from-bottom-2 duration-300",
        isUser && "flex-row-reverse",
      )}
    >
      <Avatar role={message.role} />
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "whitespace-pre-wrap rounded-tr-sm bg-primary text-sm leading-relaxed text-primary-foreground"
              : "rounded-tl-sm bg-muted text-foreground",
          )}
        >
          {isUser ? message.content : <MarkdownMessage content={message.content} />}
        </div>
        {!isUser && (
          <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void share()}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                aria-label={message.is_favorite ? "Remove from favorites" : "Save to favorites"}
                onClick={onToggleFavorite}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    message.is_favorite && "fill-primary text-primary",
                  )}
                />
              </Button>
            )}
          </div>
        )}
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
