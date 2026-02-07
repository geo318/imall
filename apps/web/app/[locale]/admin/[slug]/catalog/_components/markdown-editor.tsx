"use client";

import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function MarkdownEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-2">
      <div className="flex gap-2 border-b">
        <Button
          type="button"
          variant={mode === "edit" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setMode("edit")}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant={mode === "preview" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setMode("preview")}
        >
          Preview
        </Button>
      </div>

      {mode === "edit" ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter markdown description..."
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="text-xs text-slate-500">
            Supports Markdown syntax. Use **bold**, *italic*, lists, links, etc.
          </p>
        </>
      ) : (
        <div className="min-h-[200px] p-4 border rounded-lg bg-slate-50 prose prose-sm max-w-none">
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-slate-400 italic">No content to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
