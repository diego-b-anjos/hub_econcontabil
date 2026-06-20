import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileDown } from "lucide-react";
import type { ExportLayout, ExportSections } from "@/lib/exporters";

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expFormat: "pdf" | "xlsx";
  setExpFormat: (v: "pdf" | "xlsx") => void;
  expLayout: ExportLayout;
  applyLayoutDefaults: (lay: ExportLayout) => void;
  expMonths: number;
  setExpMonths: (v: number) => void;
  expSections: Required<ExportSections>;
  setExpSections: (updater: (p: Required<ExportSections>) => Required<ExportSections>) => void;
  decCidade: string; setDecCidade: (v: string) => void;
  decSocioNome: string; setDecSocioNome: (v: string) => void;
  decSocioCPF: string; setDecSocioCPF: (v: string) => void;
  decContadorNome: string; setDecContadorNome: (v: string) => void;
  decContadorCPF: string; setDecContadorCPF: (v: string) => void;
  decContadorCRC: string; setDecContadorCRC: (v: string) => void;
  showSN: boolean;
  showLP: boolean;
  isCompare: boolean;
  runExport: () => void;
}

export function ExportDialog({
  open,
  onOpenChange,
  expFormat,
  setExpFormat,
  expLayout,
  applyLayoutDefaults,
  expMonths,
  setExpMonths,
  expSections,
  setExpSections,
  decCidade, setDecCidade,
  decSocioNome, setDecSocioNome,
  decSocioCPF, setDecSocioCPF,
  decContadorNome, setDecContadorNome,
  decContadorCPF, setDecContadorCPF,
  decContadorCRC, setDecContadorCRC,
  showSN,
  showLP,
  isCompare,
  runExport,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Exportar relatório</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Formato</Label>
            <RadioGroup value={expFormat} onValueChange={(v) => setExpFormat(v as "pdf" | "xlsx")} className="grid grid-cols-2 gap-2">
              {[
                { v: "pdf", label: "PDF" },
                { v: "xlsx", label: "Excel (XLSX)" },
              ].map((o) => (
                <Label key={o.v} className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer text-sm ${expFormat === o.v ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value={o.v} /> {o.label}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Layout</Label>
            <RadioGroup value={expLayout} onValueChange={(v) => applyLayoutDefaults(v as ExportLayout)} className="grid md:grid-cols-3 gap-2">
              {[
                { v: "resumido", title: "Resumido", desc: "Visão geral em 1 página." },
                { v: "detalhado", title: "Detalhado", desc: "Tabelas completas + gráficos." },
                { v: "declaracao", title: "Declaração", desc: "Faturamento mensal e acumulado (modelo do contador)." },
              ].map((o) => (
                <Label key={o.v} className={`flex flex-col gap-0.5 rounded-md border p-3 cursor-pointer ${expLayout === o.v ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <RadioGroupItem value={o.v} /> {o.title}
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">{o.desc}</div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Período</Label>
            <Select value={String(expMonths)} onValueChange={(v) => setExpMonths(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ano completo (12 meses)</SelectItem>
                <SelectItem value="1">Último mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="9">Últimos 9 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Seções a incluir
              <span className="ml-2 text-muted-foreground font-normal normal-case tracking-normal">
                (opções variam conforme o layout selecionado)
              </span>
            </Label>
            <div className="grid md:grid-cols-2 gap-2 rounded-md border border-border p-3">
              {((expLayout === "declaracao"
                ? [
                    ["cabecalhoDeclaracao", "Cabeçalho institucional"],
                    ["textoDeclaratorio", "Texto declaratório"],
                    ["tabelaFaturamento", "Tabela de faturamento (mensal × acumulado)"],
                    ["assinaturas", "Assinaturas (contador + sócio)"],
                  ]
                : expLayout === "resumido"
                ? [
                    ["identificacao", "Identificação da simulação"],
                    ["resumo", "Resumo (KPIs)"],
                    ["recomendacao", "Recomendação (apenas comparativo)", !isCompare],
                    ["tabelaMensal", "Tabela mensal resumida"],
                    ["graficos", "Gráficos (comparativo + economia)"],
                  ]
                : [
                    ["identificacao", "Identificação da simulação"],
                    ["resumo", "Resumo (KPIs)"],
                    ["recomendacao", "Recomendação (apenas comparativo)", !isCompare],
                    ["tabelaMensal", "Tabela mensal resumida"],
                    ["detalhamentoSN", "Detalhamento Simples Nacional", !showSN],
                    ["detalhamentoLP", "Detalhamento Lucro Presumido", !showLP],
                    ["graficos", "Gráficos (comparativo + economia)"],
                    ["baseLegal", "Base legal e observações"],
                  ]) as [keyof ExportSections, string, boolean?][]).map(([k, label, disabled]) => (
                <Label key={k} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
                  <Checkbox
                    checked={!!expSections[k] && !disabled}
                    disabled={disabled}
                    onCheckedChange={(v) => setExpSections((p) => ({ ...p, [k]: !!v }))}
                  />
                  {label}
                </Label>
              ))}
            </div>
          </div>

          {expLayout === "declaracao" && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Dados da declaração
              </Label>
              <div className="grid md:grid-cols-2 gap-2">
                <Input placeholder="Cidade de emissão (ex.: Santana de Parnaíba)"
                  value={decCidade} onChange={(e) => setDecCidade(e.target.value)} />
                <Input placeholder="Nome do sócio / representante"
                  value={decSocioNome} onChange={(e) => setDecSocioNome(e.target.value)} />
                <Input placeholder="CPF do sócio"
                  value={decSocioCPF} onChange={(e) => setDecSocioCPF(e.target.value)} />
                <Input placeholder="Nome do contador"
                  value={decContadorNome} onChange={(e) => setDecContadorNome(e.target.value)} />
                <Input placeholder="CPF do contador"
                  value={decContadorCPF} onChange={(e) => setDecContadorCPF(e.target.value)} />
                <Input placeholder="CRC do contador"
                  value={decContadorCRC} onChange={(e) => setDecContadorCRC(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Esses dados aparecem no rodapé da declaração para assinatura.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={runExport}>
            <FileDown className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
