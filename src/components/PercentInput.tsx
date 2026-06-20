import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PercentInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Valor decimal (ex.: 0.05 = 5%) */
  value: number;
  onValueChange: (n: number) => void;
  /** Casas decimais exibidas (default 2) */
  decimals?: number;
}

/**
 * Campo de alíquota em formato percentual: o usuário digita "5,00" e o valor armazenado é 0.05.
 */
export const PercentInput = React.forwardRef<HTMLInputElement, PercentInputProps>(
  ({ value, onValueChange, decimals = 2, className, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(
      Number.isFinite(value) ? (value * 100).toFixed(decimals).replace(".", ",") : ""
    );

    React.useEffect(() => {
      setDisplay(Number.isFinite(value) ? (value * 100).toFixed(decimals).replace(".", ",") : "");
    }, [value, decimals]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          className={cn("pr-7 text-right", className)}
          value={display}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d,.-]/g, "");
            setDisplay(raw);
            const n = Number(raw.replace(/\./g, "").replace(",", "."));
            onValueChange(Number.isFinite(n) ? n / 100 : 0);
          }}
          onBlur={() => {
            setDisplay((value * 100).toFixed(decimals).replace(".", ","));
          }}
          onFocus={(e) => e.target.select()}
          {...props}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          %
        </span>
      </div>
    );
  }
);
PercentInput.displayName = "PercentInput";
