"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { BookOpen, Cookie, FileText, Mail, Scale, Shield, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "@/i18n/provider";
import type { LegalSection } from "@/lib/legal";

type LegalTabsProps = {
  sections: LegalSection[];
  initialSectionId?: string | null;
  emptyLabel: string;
};

export function LegalTabs({ sections, initialSectionId, emptyLabel }: LegalTabsProps) {
  const t = useTranslations();
  const sectionIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);
  const fallbackSection = sections[0]?.id;
  const activeDefault =
    initialSectionId && sectionIds.has(initialSectionId) ? initialSectionId : fallbackSection;
  const [activeSection, setActiveSection] = useState(activeDefault);

  if (!activeSection) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  const iconFor = (id: string) => {
    if (id.includes("privacy")) return Shield;
    if (id.includes("terms")) return FileText;
    if (id.includes("cookies")) return Cookie;
    if (id.includes("return")) return Scale;
    if (id.includes("translated")) return Tags;
    if (id.includes("contact")) return Mail;
    if (id.includes("platform")) return BookOpen;
    return Cookie;
  };

  const copyKeyFor = (id: string) => {
    if (id.includes("privacy")) return "privacy";
    if (id.includes("terms")) return "terms";
    if (id.includes("cookies")) return "cookies";
    if (id.includes("return")) return "returns";
    if (id.includes("translated")) return "glossary";
    if (id.includes("contact")) return "contact";
    if (id.includes("platform")) return "overview";
    return "generic";
  };

  const labelFor = (id: string, fallback: string) => {
    const key = copyKeyFor(id);
    if (key !== "generic") {
      return t(`legal.tabs.labels.${key}`);
    }
    const [firstWord] = fallback.trim().split(/\s+/);
    return firstWord || fallback;
  };

  const subtitleFor = (id: string) => t(`legal.tabs.subtitles.${copyKeyFor(id)}`);

  return (
    <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-8">
      <TabsList className="mx-auto grid h-auto w-full max-w-2xl grid-cols-2 gap-1 rounded-xl bg-secondary/50 p-1.5 md:grid-cols-3 lg:max-w-6xl lg:grid-cols-7">
        {sections.map((section) => {
          const Icon = iconFor(section.id);
          return (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs md:text-sm data-[state=active]:bg-background data-[state=active]:shadow-md"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{labelFor(section.id, section.title)}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sections.map((section) => {
        const Icon = iconFor(section.id);
        return (
          <TabsContent key={section.id} value={section.id}>
            <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">{subtitleFor(section.id)}</p>
                </div>
              </div>

              <article className="prose prose-slate max-w-none prose-headings:text-foreground prose-h2:text-xl prose-h2:font-semibold prose-h3:text-lg prose-h3:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-table:text-muted-foreground">
                <ReactMarkdown>{section.content}</ReactMarkdown>
              </article>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
