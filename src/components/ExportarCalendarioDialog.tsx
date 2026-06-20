import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import {
  exportarCalendarioPDF,
  exportarCalendarioExcel,
  exportarObrigacoesPDF,
  type ClienteHeaderInfo,
} from "@/lib/calendarioExport";
import type { Esfera, Obrigacao } from "@/data/tributos";

const MESES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const ESFERA_LABEL: Record<Esfera, string> = {
  federal: "Federais",
  estadual: "Estaduais",
  municipal: "Municipais",
  trabalhista: "Trabalhistas",
};

const REGIME_LABEL: Record<string, string> = {
  SN: "Simples Nacional", LP: "Lucro Presumido", LR: "Lucro Real", MEI: "MEI",
};

export type Modo = "por_mes" | "apenas_obrigacoes";
export type Periodo = "mes_atual" | "mes_especifico" | "ano";

export interface ExportarCalendarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteHeaderInfo | null;
  /** Função que devolve o universo de obrigações para um dado mês (1..12),
   * já filtradas pelo perfil aplicável (cliente, município, regime, etc.). */
  getObrigacoes: (mes: number) => Obrigacao[];
  /** Modo inicial — default `por_mes`. */
  modoInicial?: Modo;
  /** Base do nome do arquivo (sem extensão). */
  fileBase: string;
}

export function ExportarCalendarioDialog({
  open, onOpenChange, cliente, getObrigacoes, modoInicial = "por_mes", fileBase,
}: ExportarCalendarioDialogProps) {
  const { displayName, displayCrc } = useAuth();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const [mesEspec, setMesEspec] = useState(new Date().getMonth() + 1);
  const [esferas, setEsferas] = useState<Record<Esfera, boolean>>({
    federal: true, estadual: true, municipal: true, trabalhista: true,
  });
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);

  const mesesAlvo = useMemo<number[]>(() => {
    if (periodo === "ano") return Array.from({ length: 12 }, (_, i) => i + 1);
    if (periodo === "mes_atual") return [new Date().getMonth() + 1];
    return [mesEspec];
  }, [periodo, mesEspec]);

  // Obrigações disponíveis (filtradas por esferas) — para o modo "Apenas obrigações"
  // deduplicamos por id para evitar repetição entre meses.
  const universo = useMemo(() => {
    const map = new Map<string, Obrigacao>();
    for (const m of mesesAlvo) {
      for (const o of getObrigacoes(m)) {
        if (esferas[o.tipo] && !map.has(o.id)) map.set(o.id, o);
      }
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [mesesAlvo, esferas, getObrigacoes]);

  // Inicializa "todas selecionadas" quando o diálogo abre ou muda o universo
  useEffect(() => {
    if (!open) return;
    setSelecionadas(new Set(universo.map((o) => o.id)));
  }, [open, universo]);

  // Reseta modo/período/esferas ao abrir para evitar configuração obsoleta
  useEffect(() => {
    if (!open) return;
    setModo(modoInicial);
    setPeriodo("ano");
    setMesEspec(new Date().getMonth() + 1);
    setEsferas({ federal: true, estadual: true, municipal: true, trabalhista: true });
  }, [open, modoInicial]);

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selecionarTodas = () => setSelecionadas(new Set(universo.map((o) => o.id)));
  const selecionarNenhuma = () => setSelecionadas(new Set());
  const selecionarEsfera = (esf: Esfera) =>
    setSelecionadas(new Set(universo.filter((o) => o.tipo === esf).map((o) => o.id)));

  const totalPorMes = useMemo(() => {
    if (modo !== "por_mes") return 0;
    return mesesAlvo.reduce(
      (s, m) => s + getObrigacoes(m).filter((o) => esferas[o.tipo]).length, 0,
    );
  }, [modo, mesesAlvo, esferas, getObrigacoes]);

  const tituloPeriodo = periodo === "ano" ? "Anual" : MESES_NOMES[mesesAlvo[0] - 1];

  const exportarPDF = async () => {
    setExportando(true);
    try {
      if (modo === "apenas_obrigacoes") {
        const escolhidas = universo.filter((o) => selecionadas.has(o.id));
        if (!escolhidas.length) {
          toast.error("Selecione ao menos uma obrigação");
          return;
        }
        await exportarObrigacoesPDF({
          cliente, obrigacoes: escolhidas,
          fileBase: `${fileBase}-obrigacoes`,
          contadorNome: displayName(),
          contadorCrc: displayCrc(),
        });
        toast.success(`PDF exportado (${escolhidas.length} obrigações)`);
      } else {
        const secoes = mesesAlvo.map((mes) => ({
          mes,
          obrigacoes: getObrigacoes(mes)
            .filter((o) => esferas[o.tipo])
            .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome)),
        }));
        const total = secoes.reduce((s, se) => s + se.obrigacoes.length, 0);
        if (!total) { toast.error("Nenhuma obrigação no período selecionado"); return; }
        const subtitulo = cliente
          ? `Cliente: ${cliente.nome}${cliente.cnpj ? ` · CNPJ ${cliente.cnpj}` : ""}${
              cliente.municipio && cliente.uf ? ` · ${cliente.municipio}/${cliente.uf}` : ""
            }${cliente.taxRegime ? ` · ${REGIME_LABEL[cliente.taxRegime] || cliente.taxRegime}` : ""}`
          : undefined;
        await exportarCalendarioPDF({
          titulo: cliente
            ? `Calendário Fiscal ${tituloPeriodo} — ${cliente.nome}`
            : `Calendário Fiscal — ${tituloPeriodo}`,
          subtitulo, fileBase: `${fileBase}-${tituloPeriodo.toLowerCase()}`, secoes,
        });
        toast.success(`PDF exportado (${total} obrigações)`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar PDF");
    } finally {
      setExportando(false);
    }
  };

  const exportarExcel = async () => {
    if (modo !== "por_mes") return; // botão fica desabilitado, defesa extra
    setExportando(true);
    try {
      const secoes = mesesAlvo.map((mes) => ({
        mes,
        obrigacoes: getObrigacoes(mes)
          .filter((o) => esferas[o.tipo])
          .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome)),
      }));
      const total = secoes.reduce((s, se) => s + se.obrigacoes.length, 0);
      if (!total) { toast.error("Nenhuma obrigação no período selecionado"); return; }
      await exportarCalendarioExcel({
        titulo: cliente
          ? `Calendário ${tituloPeriodo} — ${cliente.nome}`
          : `Calendário — ${tituloPeriodo}`,
        fileBase: `${fileBase}-${tituloPeriodo.toLowerCase()}`, secoes,
      });
      toast.success(`Excel exportado (${total} obrigações)`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar Excel");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Exportar calendário fiscal{cliente ? ` — ${cliente.nome}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Modo */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Modo de exportação
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={modo === "por_mes" ? "default" : "outline"}
                onClick={() => setModo("por_mes")}
              >Por mês (uma seção/mês)</Button>
              <Button
                size="sm"
                variant={modo === "apenas_obrigacoes" ? "default" : "outline"}
                onClick={() => setModo("apenas_obrigacoes")}
              >Apenas obrigações (lista única)</Button>
            </div>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Período</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["mes_atual", "Mês atual"],
                ["mes_especifico", "Mês específico"],
                ["ano", "Ano completo"],
              ] as const).map(([v, label]) => (
                <Button
                  key={v} size="sm"
                  variant={periodo === v ? "default" : "outline"}
                  onClick={() => setPeriodo(v)}
                  className="text-xs"
                >{label}</Button>
              ))}
            </div>
            {periodo === "mes_especifico" && (
              <Select value={String(mesEspec)} onValueChange={(v) => setMesEspec(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_NOMES.map((nome, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Esferas */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Esferas a incluir
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ESFERA_LABEL) as Array<[Esfera, string]>).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 cursor-pointer hover:bg-muted"
                >
                  <Checkbox
                    checked={esferas[k]}
                    onCheckedChange={(v) => setEsferas((prev) => ({ ...prev, [k]: !!v }))}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lista com checkboxes — só no modo "Apenas obrigações" */}
          {modo === "apenas_obrigacoes" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Obrigações ({selecionadas.size}/{universo.length} selecionadas)
                </Label>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selecionarTodas}>Todas</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selecionarNenhuma}>Nenhuma</Button>
                  {(Object.keys(ESFERA_LABEL) as Esfera[]).map((esf) => (
                    <Button
                      key={esf} size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => selecionarEsfera(esf)}
                    >{ESFERA_LABEL[esf]}</Button>
                  ))}
                </div>
              </div>
              <ScrollArea className="h-64 rounded-md border bg-muted/20 p-2">
                {universo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma obrigação para os filtros selecionados.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {universo.map((o) => (
                      <li key={o.id}>
                        <label className="flex items-start gap-2 rounded p-1.5 cursor-pointer hover:bg-background">
                          <Checkbox
                            checked={selecionadas.has(o.id)}
                            onCheckedChange={() => toggle(o.id)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{o.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ESFERA_LABEL[o.tipo]}
                              {o.ente ? ` · ${o.ente}` : ""}
                              {` · Vence dia ${o.dia}`}
                            </p>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Resumo */}
          <div className="rounded-md border bg-primary/5 p-3 text-xs">
            <p className="font-medium">Resumo</p>
            <p className="text-muted-foreground mt-1">
              {modo === "apenas_obrigacoes"
                ? `${selecionadas.size} obrigação(ões) selecionada(s) — lista única, sem agrupamento por mês.`
                : `${totalPorMes} obrigação(ões) em ${mesesAlvo.length} mês(es).`}
              {cliente && (
                <>
                  {" · "}{cliente.municipio || "—"}/{cliente.uf || "—"}
                  {" · "}{cliente.taxRegime ? (REGIME_LABEL[cliente.taxRegime] || cliente.taxRegime) : "Sem regime definido"}
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exportando}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={exportarExcel}
            disabled={exportando || modo !== "por_mes"}
            title={modo !== "por_mes" ? "Excel disponível apenas no modo Por mês" : undefined}
          >
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Exportar Excel
          </Button>
          <Button
            onClick={exportarPDF}
            disabled={exportando}
            className="bg-primary text-primary-foreground"
          >
            {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
