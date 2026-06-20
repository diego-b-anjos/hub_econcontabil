import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatBRLInput, maskMoneyTyping } from "@/lib/format";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "prefix"> {
  value: number;
  onValueChange: (n: number) => void;
  prefix?: boolean;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, prefix = true, className, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(
      value ? formatBRLInput(value) : ""
    );

    // Sincroniza quando o valor externo muda (ex.: distribuição anual)
    React.useEffect(() => {
      setDisplay(value ? formatBRLInput(value) : "");
    }, [value]);

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            R$
          </span>
        )}
        <Input
          ref={ref}
          inputMode="numeric"
          className={cn(prefix ? "pl-8 text-right" : "text-right", className)}
          value={display}
          onChange={(e) => {
            const { display: d, value: v } = maskMoneyTyping(e.target.value);
            setDisplay(d);
            onValueChange(v);
          }}
          onFocus={(e) => e.target.select()}
          {...props}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
