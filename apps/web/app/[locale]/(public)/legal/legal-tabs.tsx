"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { BookOpen, Cookie, FileText, Mail, Scale, Shield, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { LegalSection } from "@/lib/legal";

type LegalTabsProps = {
  sections: LegalSection[];
  initialSectionId?: string | null;
  emptyLabel: string;
};

export function LegalTabs({ sections, initialSectionId, emptyLabel }: LegalTabsProps) {
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

  const subtitleFor = (id: string) => {
    if (id.includes("privacy")) return "How we collect, use, and protect your data";
    if (id.includes("terms")) return "Rules and conditions for using our platform";
    if (id.includes("cookies")) return "How we use cookies and similar technologies";
    if (id.includes("return")) return "Our commitment to fair returns and refunds";
    if (id.includes("translated")) return "Reference terms across supported languages";
    if (id.includes("contact")) return "How to reach us for legal and data-right requests";
    if (id.includes("platform")) return "How iMall operates as a marketplace intermediary";
    return "Legal policy details";
  };

  const labelFor = (id: string, fallback: string) => {
    if (id.includes("privacy")) return "Privacy";
    if (id.includes("terms")) return "Terms";
    if (id.includes("cookies")) return "Cookies";
    if (id.includes("return")) return "Returns";
    if (id.includes("translated")) return "Glossary";
    if (id.includes("contact")) return "Contact";
    if (id.includes("platform")) return "Overview";
    const [firstWord] = fallback.trim().split(/\s+/);
    return firstWord || fallback;
  };

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
