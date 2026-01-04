import * as React from "react";
import { cn } from "./utils";

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  htmlFor: string;
  children: React.ReactNode;
};

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn("text-sm font-medium text-slate-800", className)}
        {...props}
      >
        {children}
      </label>
    );
  },
);
Label.displayName = "Label";

export { Label };
