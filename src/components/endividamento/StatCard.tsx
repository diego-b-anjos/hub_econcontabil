import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  highlight?: boolean;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, highlight, hint }: Props) {
  return (
    <div className={cn(
      "rounded-xl p-4 sm:p-5 border shadow-card transition-all overflow-hidden min-w-0",
      highlight ? "bg-gradient-brand border-primary text-primary-foreground" : "bg-card border-border",
    )}>
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium uppercase tracking-wide", highlight ? "text-secondary" : "text-muted-foreground")}>{label}</p>
          <p className={cn("text-xl xl:text-2xl font-bold mt-2 tabular-nums leading-tight break-words", highlight ? "text-secondary" : "text-foreground")}>{value}</p>
          {hint && <p className={cn("text-xs mt-1", highlight ? "text-secondary/80" : "text-muted-foreground")}>{hint}</p>}
        </div>
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          highlight ? "bg-secondary text-primary" : "bg-primary/10 text-secondary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
