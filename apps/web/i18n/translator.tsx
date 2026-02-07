import React, { type ReactNode } from "react";
import type { Dictionary } from "./types.js";

type RichHandler = (chunks: ReactNode) => ReactNode;
type Values = Record<string, string | number>;
type RichValues = Record<string, RichHandler | string | number>;
export type Translator = {
  (key: string, values?: Values): string;
  raw: (key: string) => unknown;
  rich: (key: string, values: RichValues) => ReactNode;
};

function getValue(messages: Dictionary, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(value: string, values?: Values): string {
  if (!values) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => {
    const replacement = values[key];
    return replacement === undefined || replacement === null ? "" : String(replacement);
  });
}

function applyRichTags(value: ReactNode, richValues: RichValues): ReactNode {
  let nodes: ReactNode[] = [value];

  for (const [tag, handler] of Object.entries(richValues)) {
    if (typeof handler !== "function") continue;
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");

    nodes = nodes.flatMap((node) => {
      if (typeof node !== "string") return [node];
      const segments: ReactNode[] = [];
      let lastIndex = 0;
      for (const match of node.matchAll(regex)) {
        const matchIndex = match.index ?? 0;
        if (matchIndex > lastIndex) {
          segments.push(node.slice(lastIndex, matchIndex));
        }
        segments.push(handler(match[1] ?? ""));
        lastIndex = matchIndex + match[0].length;
      }
      if (lastIndex < node.length) {
        segments.push(node.slice(lastIndex));
      }
      return segments;
    });
  }

  const flattened = nodes.flatMap((node) =>
    Array.isArray(node) ? node.flatMap(flattenNode) : [node],
  );
  if (flattened.length === 1) return flattened[0];

  return flattened.map((node, index) => {
    if (node === null || node === undefined || typeof node === "boolean") return null;
    if (typeof node === "string" || typeof node === "number") {
      return <React.Fragment key={node}>{node}</React.Fragment>;
    }
    if (React.isValidElement(node)) {
      return React.cloneElement(node, { key: node.key ?? index });
    }
    return <React.Fragment key={node.toString()}>{node}</React.Fragment>;
  });
}

function flattenNode(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) {
    return node.flatMap(flattenNode);
  }
  return [node];
}

export function createTranslator(messages: Dictionary): Translator {
  function translate(key: string, values?: Values): string {
    const raw = getValue(messages, key);
    if (typeof raw !== "string") return "";
    return interpolate(raw, values);
  }

  function raw(key: string): unknown {
    return getValue(messages, key);
  }

  function rich(key: string, values: RichValues): ReactNode {
    const rawValue = getValue(messages, key);
    if (typeof rawValue !== "string") return rawValue as ReactNode;

    const interpolated = interpolate(
      rawValue,
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => typeof value !== "function"),
      ) as Values,
    );
    return applyRichTags(interpolated, values);
  }

  (translate as Translator).raw = raw;
  (translate as Translator).rich = rich;
  return translate as Translator;
}
