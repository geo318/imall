"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  shopSlug: string;
  initialName: string;
  initialSettings: string;
};

export function ShopSettingsForm({ shopSlug, initialName, initialSettings }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState(() => initialSettings || "{}");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/${shopSlug}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, settings }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update settings");
        }

        toast.success("Settings saved");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update settings");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="shop-name">Shop name</Label>
        <Input
          id="shop-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Shop name"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="shop-settings">Shop settings (JSON)</Label>
        <Textarea
          id="shop-settings"
          value={settings}
          onChange={(event) => setSettings(event.target.value)}
          placeholder='{"theme":"dark"}'
          className="min-h-[160px] font-mono text-xs"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
