"use client";

import { AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  deletedAt: string | null | undefined;
  draft: boolean | undefined;
};

export function ProductStatusBanner({ deletedAt, draft }: Props) {
  if (!deletedAt && !draft) {
    return null;
  }

  if (deletedAt) {
    return (
      <div
        className={cn(
          "mb-6 rounded-lg border-2 p-4",
          "bg-red-50 border-red-200 text-red-900",
          "dark:bg-red-950 dark:border-red-800 dark:text-red-100",
        )}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">This product has been deleted</h3>
            <p className="text-sm opacity-90">
              This product is no longer available to the public. Only you (the owner) can view it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (draft) {
    return (
      <div
        className={cn(
          "mb-6 rounded-lg border-2 p-4",
          "bg-blue-50 border-blue-200 text-blue-900",
          "dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100",
        )}
      >
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">This product is a draft</h3>
            <p className="text-sm opacity-90">
              This product is not published yet. Only you (the owner) can view it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
