"use client";

import * as React from "react";
import { cn } from "./utils";
import { Label } from "./label";
import { Textarea } from "./textarea";

type MarkdownEditorProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  className?: string;
};

// Lightweight markdown editor stub. Replace with a real parser (e.g. remark)
// later; currently renders a minimal preview with line breaks.
export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  helperText,
  className,
}: MarkdownEditorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={id} className="block">
          {label}
        </Label>
      )}
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[180px]"
      />
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">Preview</p>
        <div className="mt-1 whitespace-pre-wrap text-slate-700">{value || "No content"}</div>
      </div>
    </div>
  );
}
