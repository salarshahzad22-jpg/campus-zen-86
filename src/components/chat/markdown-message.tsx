import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = extractText(children);
  return (
    <div className="group/code relative my-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-2 top-2 h-7 opacity-0 transition-opacity group-hover/code:opacity-100"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <pre className="overflow-x-auto rounded-xl border bg-muted/60 p-4 text-xs leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ className, children, ...props }) => (
            <code
              className={
                className
                  ? className
                  : "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
              }
              {...props}
            >
              {children}
            </code>
          ),
          h1: ({ children }) => <h3 className="mt-3 mb-2 text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h4 className="mt-3 mb-2 text-sm font-semibold">{children}</h4>,
          h3: ({ children }) => <h5 className="mt-3 mb-1 text-sm font-semibold">{children}</h5>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
