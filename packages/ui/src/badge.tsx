import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand-200 bg-brand-50 text-brand-800",
        secondary: "border-slate-200 bg-slate-100 text-slate-800",
        outline: "border-slate-300 text-slate-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
