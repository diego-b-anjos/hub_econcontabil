import { useMemo, useRef, useState } from "react";
import {
  History,
  FileSpreadsheet,
  FileDown,
  Trash2,
  Upload,
  Download,
  GitCompare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RelatorioFiscal, Orgao } from "@/lib/endividamento/types";
import { orgaoLabel, fmtBRL } from "@/lib/endividamento/format";
import { exportarExcel, exportarPDF, extrairSnapshotDeArquivo } from "@/lib/endividamento/exporters";
import { toast } from "sonner";

export interface VersaoSnapshot {
  /** Número da versão capturada. */
  versao: number;
  /** Carimbo do momento da exportação (ISO). */
  exportadoEm: string;
  /** Tipo do arquivo gerado naquele momento. */
  formato: "excel" | "pdf";
  /** Snapshot completo do relatório, suficiente para reexportação. */
  relatorio: RelatorioFiscal;
  /** Nome amigável definido pelo usuário (ex: "Cliente A — Atualização PGFN"). */
  nome?: string;
  /** Data lógica da versão (dd/mm/aaaa) — independente do `exportadoEm`. */
  dataVersao?: string;
}

interface Props {
  historico: VersaoSnapshot[];
  onClear: () => void;
  onRemove: (index: number) => void;
  onImport: (snaps: VersaoSnapshot[]) => void;
}

export function HistoricoVersoes({ historico, onClear, onRemove, onImport }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [aba, setAba] = useState<"versoes" | "comparativo">("versoes");

  const reexportar = async (snap: VersaoSnapshot, formato: "excel" | "pdf", idx: number) => {
    try {
      setBusy(idx);
      if (formato === "excel") await exportarExcel(snap.relatorio);
      else await exportarPDF(snap.relatorio);
      toast.success(`Versão #${snap.versao} reexportada (${formato.toUpperCase()})`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao reexportar");
    } finally {
      setBusy(null);
    }
  };

  const baixarSnapshot = (snap: VersaoSnapshot) => {
    const blob = new Blob([JSON.stringify(snap, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (snap.nome || `versao-${snap.versao}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    a.download = `${safeName || "snapshot"}.painel-fiscal.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarTodos = () => {
    const blob = new Blob([JSON.stringify(historico, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-painel-fiscal.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = async (files: FileList | null) => {
    if (!files?.length) return;
    const novos: VersaoSnapshot[] = [];
    for (const f of Array.from(files)) {
      const nome = f.name.toLowerCase();
      // PDF/Excel gerados pelo próprio sistema: extrai snapshot embutido.
      if (nome.endsWith(".pdf") || nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
        try {
          const rel = await extrairSnapshotDeArquivo(f);
          if (rel) {
            novos.push({
              versao: rel.versao || 1,
              exportadoEm: new Date(f.lastModified).toISOString(),
              formato: nome.endsWith(".pdf") ? "pdf" : "excel",
              relatorio: rel,
              nome: f.name.replace(/\.(pdf|xlsx|xls)$/i, ""),
              dataVersao: rel.dataAtualizacao,
            });
          } else {
            toast.warning(
              `${f.name}: não foi possível extrair snapshot. Use um arquivo gerado por este sistema.`,
            );
          }
        } catch (e) {
          console.error(e);
          toast.error(`Falha ao ler ${f.name}`);
        }
        continue;
      }
      try {
        const txt = await f.text();
        const data = JSON.parse(txt);
        const arr = Array.isArray(data) ? data : [data];
        arr.forEach((s) => {
          if (s && s.relatorio && typeof s.versao === "number") {
            novos.push(s as VersaoSnapshot);
          }
        });
      } catch (e) {
        console.error(e);
        toast.error(`Arquivo inválido: ${f.name}`);
      }
    }
    if (novos.length) {
      onImport(novos);
      toast.success(`${novos.length} versão(ões) importada(s)`);
    } else {
      toast.warning("Nenhuma versão válida encontrada");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleSelecionado = (i: number) => {
    setSelecionados((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );
  };

  const ORGAOS_COMP: Orgao[] = ["RFB", "PGFN", "Estadual", "Municipal"];

  /** Constrói linhas de indicadores para todas as versões selecionadas. */
  const comparativo = useMemo(() => {
    if (selecionados.length < 2) return null;
    const versoes = selecionados
      .map((i) => historico[i])
      .filter(Boolean) as VersaoSnapshot[];
    if (versoes.length < 2) return null;
    const valor = (s: VersaoSnapshot, kind: "total" | "parc" | Orgao) => {
      if (kind === "total") return s.relatorio.debitos.reduce((a, d) => a + d.total, 0);
      if (kind === "parc")
        return s.relatorio.parcelamentos.reduce((a, p) => a + (p.valorEmAtraso || 0), 0);
      return s.relatorio.debitos
        .filter((d) => d.orgao === kind)
        .reduce((a, d) => a + d.total, 0);
    };
    const linhas: { label: string; valores: number[] }[] = [
      { label: "Total débitos", valores: versoes.map((v) => valor(v, "total")) },
      { label: "Parc. em atraso", valores: versoes.map((v) => valor(v, "parc")) },
      ...ORGAOS_COMP.map((o) => ({
        label: `Débitos ${orgaoLabel(o)}`,
        valores: versoes.map((v) => valor(v, o)),
      })),
    ];
    return { versoes, linhas };
  }, [selecionados, historico]);

  /** Δ de cada coluna em relação à PRIMEIRA versão selecionada (base). */
  const fmtDelta = (base: number, atual: number) => {
    const diff = atual - base;
    const sign = diff > 0 ? "+" : "";
    const pct = base === 0 ? (atual === 0 ? "0%" : "—") : `${((diff / base) * 100).toFixed(1)}%`;
    return { texto: `${sign}${fmtBRL(diff)} (${pct})`, positivo: diff > 0, neutro: diff === 0 };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de versões exportadas
          </CardTitle>
          <CardDescription>
            Cada exportação cria um snapshot. Reexporte uma versão antiga sem perder
            o estado atual. Você também pode baixar/importar versões em JSON e
            comparar duas versões lado a lado.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,application/pdf,.pdf,.xlsx,.xls"
            multiple
            hidden
            onChange={(e) => importar(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Importar (PDF/Excel/JSON)
          </Button>
          <Button variant="outline" size="sm" onClick={baixarTodos}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selecionados.length < 2}
            onClick={() => setAba("comparativo")}
          >
            <GitCompare className="h-3.5 w-3.5 mr-1.5" />
            Comparar ({selecionados.length})
          </Button>
          <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpar histórico
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
              <AlertDialogDescription>
                Os {historico.length} snapshot(s) serão removidos. Esta ação não
                pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>Limpar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={aba} onValueChange={(v) => setAba(v as "versoes" | "comparativo")}>
          <TabsList className="mb-4">
            <TabsTrigger value="versoes">Versões ({historico.length})</TabsTrigger>
            <TabsTrigger value="comparativo" disabled={selecionados.length < 2}>
              Comparativo {selecionados.length >= 2 ? `(${selecionados.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="versoes" className="mt-0">
            <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-20">Versão</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data da versão</TableHead>
                <TableHead>Exportado em</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Datas por ente</TableHead>
                <TableHead className="text-right">Total devido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum snapshot ainda. Exporte uma versão ou importe um PDF/Excel/JSON gerado por este sistema.
                  </TableCell>
                </TableRow>
              )}
              {historico.map((s, i) => {
                const total = s.relatorio.debitos.reduce((acc, d) => acc + d.total, 0);
                const datas = s.relatorio.datasPorOrgao || {};
                const entradas = (Object.keys(datas) as Orgao[]).filter((o) => datas[o]);
                return (
                  <TableRow key={`${s.versao}-${s.exportadoEm}-${i}`}>
                    <TableCell>
                      <Checkbox
                        checked={selecionados.includes(i)}
                        onCheckedChange={() => toggleSelecionado(i)}
                        aria-label="Selecionar para comparar"
                      />
                    </TableCell>
                    <TableCell className="font-semibold">#{s.versao}</TableCell>
                    <TableCell className="text-sm">
                      {s.nome ? (
                        <span className="font-medium">{s.nome}</span>
                      ) : (
                        <span className="text-muted-foreground italic">— sem nome —</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.dataVersao || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.exportadoEm).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {s.formato}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {entradas.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {entradas.map((o) => (
                            <span
                              key={o}
                              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"
                            >
                              <span className="text-muted-foreground">{orgaoLabel(o)}:</span>
                              <span className="font-medium">{datas[o]}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === i}
                          onClick={() => reexportar(s, "excel", i)}
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === i}
                          onClick={() => reexportar(s, "pdf", i)}
                        >
                          <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => baixarSnapshot(s)}
                          title="Baixar snapshot JSON"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onRemove(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
            </div>
          </TabsContent>

          <TabsContent value="comparativo" className="mt-0 space-y-4">
            {!comparativo ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Selecione pelo menos 2 versões na aba "Versões" para comparar.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Comparando <strong>{comparativo.versoes.length}</strong> versões.
                    A primeira versão (V1) é a base para o cálculo de Δ.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSelecionados([])}>
                    Limpar seleção
                  </Button>
                </div>

                <div
                  className="grid gap-3 text-xs"
                  style={{
                    gridTemplateColumns: `repeat(${comparativo.versoes.length}, minmax(0, 1fr))`,
                  }}
                >
                  {comparativo.versoes.map((s, idx) => (
                    <div
                      key={`${s.versao}-${s.exportadoEm}-${idx}`}
                      className="rounded border border-border bg-muted/30 p-3"
                    >
                      <div className="font-semibold text-sm">
                        V{idx + 1} {idx === 0 && <span className="text-[10px] font-normal text-muted-foreground">(base)</span>} — #{s.versao}
                        {s.nome ? ` · ${s.nome}` : ""}
                      </div>
                      <div className="text-muted-foreground mt-1">
                        Data: {s.dataVersao || "—"}
                      </div>
                      <div className="text-muted-foreground">
                        Exportado: {new Date(s.exportadoEm).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        {comparativo.versoes.map((s, idx) => (
                          <TableHead
                            key={`h-${idx}`}
                            className="text-right whitespace-nowrap"
                          >
                            V{idx + 1} (#{s.versao})
                          </TableHead>
                        ))}
                        {comparativo.versoes.length >= 2 && (
                          <TableHead className="text-right whitespace-nowrap">
                            Δ (V{comparativo.versoes.length} − V1)
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparativo.linhas.map((row) => {
                        const base = row.valores[0];
                        const ultimo = row.valores[row.valores.length - 1];
                        const d = fmtDelta(base, ultimo);
                        return (
                          <TableRow key={row.label}>
                            <TableCell className="text-sm font-medium">
                              {row.label}
                            </TableCell>
                            {row.valores.map((v, idx) => {
                              const dCol = idx === 0 ? null : fmtDelta(base, v);
                              return (
                                <TableCell
                                  key={`v-${idx}`}
                                  className="text-right"
                                >
                                  <div>{fmtBRL(v)}</div>
                                  {dCol && !dCol.neutro && (
                                    <div
                                      className={
                                        "text-[10px] " +
                                        (dCol.positivo
                                          ? "text-destructive"
                                          : "text-emerald-600")
                                      }
                                    >
                                      {dCol.texto}
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell
                              className={
                                "text-right font-medium " +
                                (d.neutro
                                  ? "text-muted-foreground"
                                  : d.positivo
                                  ? "text-destructive"
                                  : "text-emerald-600")
                              }
                            >
                              {d.texto}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}