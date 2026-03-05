import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeMarkdownInput } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const normalizedContent = normalizeMarkdownInput(content);

  return (
    <div
      className={cn(
        "prose prose-slate max-w-none prose-headings:text-foreground prose-h1:mb-4 prose-h1:border-b prose-h1:pb-2 prose-h1:text-3xl prose-h2:mb-3 prose-h2:mt-8 prose-h2:border-b prose-h2:pb-1 prose-h2:text-2xl prose-h3:mb-2 prose-h3:mt-6 prose-h3:text-xl prose-p:leading-7 prose-p:text-muted-foreground prose-li:marker:text-slate-400 prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-emerald-700 prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-emerald-800 prose-hr:my-6",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, ...props }) => {
            const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
            return (
              <a
                {...props}
                href={href}
                rel={isExternal ? "noopener noreferrer" : undefined}
                target={isExternal ? "_blank" : undefined}
              />
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
