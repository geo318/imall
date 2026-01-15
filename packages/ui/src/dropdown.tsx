"use client";

import * as React from "react";
import { cn } from "./utils";

type DropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
};

export function Dropdown({ trigger, children, align = "right", className }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full text-left">
        {trigger}
      </button>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  className,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as { className?: string; [key: string]: unknown };
    return React.cloneElement(
      children,
      {
        ...childProps,
        className: cn(
          "flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer",
          childProps.className,
        ),
      } as React.Attributes,
    );
  }

  return (
    <button
      type="button"
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-slate-200 my-1", className)} />;
}
