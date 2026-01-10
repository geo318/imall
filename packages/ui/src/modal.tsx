"use client";

import type * as React from "react";
import { cn } from "./utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ open, onClose, children }: Readonly<ModalProps>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <dialog open className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3 top-3 rounded-full bg-white p-1 text-slate-500 shadow hover:text-slate-700"
        >
          ×
        </button>
        {children}
      </dialog>
    </div>
  );
}

export function ModalHeader({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("border-b border-slate-200 px-6 py-4", className)} {...props} />;
}

export function ModalTitle({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLHeadingElement>>) {
  return <h2 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />;
}

export function ModalDescription({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLParagraphElement>>) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

export function ModalBody({ className, ...props }: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

export function ModalFooter({
  className,
  ...props
}: Readonly<React.HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}
