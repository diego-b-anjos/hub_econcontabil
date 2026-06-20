import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orgaoLabel } from "@/lib/endividamento/format";
import type { CertidaoNegativa } from "@/lib/endividamento/types";

interface Props {
  items: CertidaoNegativa[];
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<CertidaoNegativa>) => void;
}

export function CertidoesNegativasCard({ items, onRemove, onUpdate }: Props) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-card overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
        <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        <div>
          <h3 className="font-bold text-emerald-900 dark:text-emerald-200">Órgãos sem débitos</h3>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
            Certidões negativas reconhecidas — edite emissão/validade conforme a certidão original.
          </p>
        </div>
      </header>
      <div className="divide-y divide-emerald-500/15">
        {items.map((c) => (
          <div key={c.id} className="px-5 py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">SEM DÉBITOS</Badge>
                <span className="font-semibold text-foreground">{c.emissor}</span>
                <span className="text-xs text-muted-foreground">({orgaoLabel(c.orgao)})</span>
              </div>
              {onUpdate ? (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-xl">
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Nº Certidão</Label>
                    <Input
                      value={c.numero || ""}
                      onChange={(e) => onUpdate(c.id, { numero: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Emissão</Label>
                    <Input
                      value={c.dataEmissao || ""}
                      placeholder="dd/mm/aaaa"
                      onChange={(e) => onUpdate(c.id, { dataEmissao: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Validade</Label>
                    <Input
                      value={c.validade || ""}
                      placeholder="dd/mm/aaaa"
                      onChange={(e) => onUpdate(c.id, { validade: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {c.numero ? `Certidão nº ${c.numero}` : ""}
                  {c.dataEmissao ? ` • Emitida em ${c.dataEmissao}` : ""}
                  {c.validade ? ` • Validade: ${c.validade}` : ""}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">📄 {c.arquivo}</p>
            </div>
            {onRemove && (
              <Button size="icon" variant="ghost" onClick={() => onRemove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}