import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "destructive";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "text-foreground",
  success: "border-transparent bg-emerald-100 text-emerald-800",
  destructive: "border-transparent bg-red-100 text-red-700",
};

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  return <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`} {...props} />;
}
