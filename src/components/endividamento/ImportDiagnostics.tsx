import { AlertTriangle, CheckCircle2, FileWarning, RefreshCcw, Columns3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DiagnosticoImport } from "@/lib/endividamento/types";

interface Props {
  items: DiagnosticoImport[];
  onReimport: () => void;
  onClear: () => void;
  onReprocessColumn?: (arquivo: string) => void;
  reprocessingFile?: string | null;
  canReprocess?: (arquivo: string) => boolean;
}

const tipoLabel: Record<DiagnosticoImport["tipoDetectado"], string> = {
  "situacao-fiscal": "Situação Fiscal (RFB/PGFN)",
  "darf": "DARF — Receita Federal",
  "parcelamento-rfb": "Parcelamento RFB",
  "municipal-osasco": "Municipal — Prefeitura de Osasco",
  "cnd-negativa": "Certidão Negativa de Débitos",
  "pgfn-regularize": "PGFN — Regularize (Dívida Ativa)",
  "pgfn-csv": "PGFN — CSV consolidado da Dívida",
  "sefaz-sp": "SEFAZ-SP — Pendências Fiscais",
  "pge-sp": "PGE-SP — Dívida Ativa Estadual",
  "generico": "Estadual/Municipal genérico",
  "desconhecido": "Não reconhecido",
};

export function ImportDiagnostics({ items, onReimport, onClear, onReprocessColumn, reprocessingFile, canReprocess }: Props) {
  if (!items.length) return null;
  const totalDeb = items.reduce((s, d) => s + d.debitosEncontrados, 0);
  const totalParc = items.reduce((s, d) => s + d.parcelamentosEncontrados, 0);
  const hasIssues = items.some(
    (d) => d.avisos.length || d.camposNaoEncontrados.length || d.linhasNaoReconhecidas.length || d.debitosEncontrados === 0,
  );

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          {hasIssues
            ? <FileWarning className="h-5 w-5 text-amber-600" />
            : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          <div>
            <h3 className="font-semibold text-sm">Relatório de importação</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} arquivo(s) processado(s) • {totalDeb} débitos • {totalParc} parcelamentos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReimport}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Reenviar / Ajustar
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="divide-y divide-border">
        {items.map((d, i) => {
          const ok = d.debitosEncontrados > 0 || d.parcelamentosEncontrados > 0;
          return (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "inline-flex h-2 w-2 rounded-full shrink-0",
                    ok ? "bg-emerald-500" : "bg-amber-500",
                  )} />
                  <span className="font-medium text-sm truncate" title={d.arquivo}>{d.arquivo}</span>
                  <Badge variant="secondary" className="text-[10px]">{tipoLabel[d.tipoDetectado]}</Badge>
                  {d.modo === "coluna" && (
                    <Badge variant="outline" className="text-[10px]">modo coluna</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{d.paginas} págs</span>
                    <span>{d.debitosEncontrados} débitos</span>
                    <span>{d.parcelamentosEncontrados} parcelamentos</span>
                  </div>
                  {onReprocessColumn && canReprocess?.(d.arquivo) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReprocessColumn(d.arquivo)}
                      disabled={reprocessingFile === d.arquivo}
                    >
                      <Columns3 className={cn("h-3.5 w-3.5 mr-1.5", reprocessingFile === d.arquivo && "animate-pulse")} />
                      {reprocessingFile === d.arquivo ? "Reprocessando..." : "Reprocessar (modo coluna)"}
                    </Button>
                  )}
                </div>
              </div>

              {d.paginasComTabela.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tabelas reconhecidas nas páginas: {d.paginasComTabela.join(", ")}
                </p>
              )}

              {d.camposNaoEncontrados.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-amber-700">Campos não encontrados: </span>
                  <span className="text-muted-foreground">{d.camposNaoEncontrados.join(", ")}</span>
                </div>
              )}

              {d.avisos.length > 0 && (
                <ul className="text-xs space-y-1">
                  {d.avisos.map((a, j) => (
                    <li key={j} className="flex gap-1.5 text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}

              {d.linhasNaoReconhecidas.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Padrões não reconhecidos ({d.linhasNaoReconhecidas.length} amostras)
                  </summary>
                  <ul className="mt-1.5 space-y-1 font-mono text-[11px] bg-muted/40 rounded p-2 max-h-40 overflow-y-auto">
                    {d.linhasNaoReconhecidas.map((l, j) => (
                      <li key={j} className="truncate" title={l}>{l}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
