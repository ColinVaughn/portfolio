"use client";

import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white border border-primary hover:bg-primary/90",
        secondary:
          "bg-white/[0.08] text-white border border-white/[0.08] hover:bg-white/[0.12]",
        ghost:
          "text-text-dim hover:text-white hover:bg-white/[0.04]",
        outline:
          "border border-white/[0.08] bg-transparent text-white hover:bg-white/[0.04]",
        danger:
          "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
      },
      size: {
        sm: "px-4 py-2 text-xs",
        md: "px-6 py-3 text-sm",
        lg: "px-8 py-4 text-sm",
        xl: "px-10 py-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
