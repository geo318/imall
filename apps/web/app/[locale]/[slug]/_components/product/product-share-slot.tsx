"use client";

import { Button } from "@repo/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import {
  EmailIcon,
  EmailShareButton,
  FacebookMessengerIcon,
  FacebookMessengerShareButton,
  TelegramIcon,
  TelegramShareButton,
  ViberIcon,
  ViberShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/provider";
import type { ApiProduct } from "@/lib/api/products";

type Props = {
  product: ApiProduct;
  productIdentifier: string;
};

/**
 * Product share component with social media and copy link options
 */
export function ProductShareSlot({ product, productIdentifier }: Props) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  // Get the current URL
  const url = typeof window !== "undefined" ? `${window.location.origin}/${productIdentifier}` : "";

  const title = product.title;
  const description =
    product.description || t("productShare.defaultDescription", { title: product.title });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("productShare.toasts.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error(t("productShare.toasts.copyFailed"));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card">
      <span className="text-sm font-semibold text-slate-700">{t("productShare.label")}</span>

      <div className="flex items-center gap-2">
        {/* WhatsApp */}
        <WhatsappShareButton
          url={url}
          title={title}
          separator=" - "
          className="flex items-center justify-center"
        >
          <WhatsappIcon size={32} round />
        </WhatsappShareButton>

        {/* Messenger */}
        <FacebookMessengerShareButton
          url={url}
          appId={process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || ""}
          className="flex items-center justify-center"
        >
          <FacebookMessengerIcon size={32} round />
        </FacebookMessengerShareButton>

        {/* Viber */}
        <ViberShareButton url={url} title={title} className="flex items-center justify-center">
          <ViberIcon size={32} round />
        </ViberShareButton>

        {/* Telegram */}
        <TelegramShareButton url={url} title={title} className="flex items-center justify-center">
          <TelegramIcon size={32} round />
        </TelegramShareButton>

        {/* Email */}
        <EmailShareButton
          url={url}
          subject={title}
          body={description}
          className="flex items-center justify-center"
        >
          <EmailIcon size={32} round />
        </EmailShareButton>

        {/* Copy Link */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="h-8 w-8 p-0 rounded-full"
          title={t("productShare.copy")}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
