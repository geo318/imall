import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultLocale, type Locale } from "@/i18n/config";

export type LegalSection = {
  id: string;
  title: string;
  content: string;
};

const LEGAL_CONTENT_ROOT = path.join(process.cwd(), "content", "legal");

function sectionTitleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractMarkdownTitle(content: string) {
  const titleLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  return titleLine ? titleLine.replace(/^#\s+/, "").trim() : null;
}

async function readSectionFile(locale: Locale, sectionId: string) {
  const filePath = path.join(LEGAL_CONTENT_ROOT, locale, `${sectionId}.md`);
  return fs.readFile(filePath, "utf8");
}

async function listSectionIds(locale: Locale) {
  const directoryPath = path.join(LEGAL_CONTENT_ROOT, locale);
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const preferredOrder = [
    "privacy-policy",
    "terms-of-service",
    "cookies-policy",
    "return-and-cancellation-policy",
    "platform-overview",
    "translated-terms",
    "contact-information",
  ];

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.replace(/\.md$/i, ""))
    .sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
}

export async function getLegalSections(locale: Locale): Promise<LegalSection[]> {
  let sectionIds: string[] = [];

  try {
    sectionIds = await listSectionIds(defaultLocale);
  } catch {
    sectionIds = [];
  }

  if (sectionIds.length === 0) {
    try {
      sectionIds = await listSectionIds(locale);
    } catch {
      sectionIds = [];
    }
  }

  if (sectionIds.length === 0) {
    return [];
  }

  const sections = await Promise.all(
    sectionIds.map(async (sectionId) => {
      let content: string;
      try {
        content = await readSectionFile(locale, sectionId);
      } catch {
        content = await readSectionFile(defaultLocale, sectionId);
      }

      return {
        id: sectionId,
        title: extractMarkdownTitle(content) ?? sectionTitleFromSlug(sectionId),
        content,
      };
    }),
  );

  return sections;
}
