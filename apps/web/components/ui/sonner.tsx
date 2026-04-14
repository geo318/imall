"use client";

import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      closeButton
      richColors
      expand={false}
      visibleToasts={4}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group toast rounded-xl border shadow-xl backdrop-blur-sm group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border-border/80",
          title: "text-sm font-semibold",
          description: "text-sm group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-emerald-600 group-[.toast]:text-white group-[.toast]:hover:bg-emerald-700",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 group-[.toast]:hover:bg-slate-200",
          closeButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-slate-500 group-[.toast]:border-0 group-[.toast]:hover:text-slate-800",
          success:
            "group-[.toast]:bg-emerald-50 group-[.toast]:text-emerald-900 group-[.toast]:border-emerald-200",
          error: "group-[.toast]:bg-red-50 group-[.toast]:text-red-900 group-[.toast]:border-red-200",
          warning:
            "group-[.toast]:bg-amber-50 group-[.toast]:text-amber-900 group-[.toast]:border-amber-200",
          info: "group-[.toast]:bg-sky-50 group-[.toast]:text-sky-900 group-[.toast]:border-sky-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
