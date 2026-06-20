import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Upload, Users } from "lucide-react";
import type { RefObject } from "react";
import { DataPersistencePanel } from "@/components/DataPersistencePanel";
import type { SciFatRow } from "@/lib/sci/parser";
import type { AcessoriasRow } from "@/lib/acessorias/parser";
import type { ChecklistRow } from "@/lib/integracoes/checklist-parser";
import type { ProtocoloRow } from "@/lib/sci/protocolos-parser";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SciSummary = { totalClientes: number; totalGeral: number };
type AccSummary = { total: number; taxaPontualidade: number };
type ChecklistSummary = { total: number; ativos: number; porResponsavel: { nome: string; total: number }[] };
type ProtocolosSummary = { total: number; totalClientes: number; valorTotalImpostos: number };

export type StatusCardsRowProps = {
  sci: SciFatRow[];
  acc: AcessoriasRow[];
  checklist: ChecklistRow[];
  protocolos: ProtocoloRow[];
  sciSummary: SciSummary;
  accSummary: AccSummary;
  checklistSummary: ChecklistSummary;
  protocolosSummary: ProtocolosSummary;
  excluirAtrasadas: boolean;
  checklistRespMapSize: number;
  checklistRef: RefObject<HTMLInputElement>;
  onChecklistFile: (f: File) => void;
  setChecklist: (rows: ChecklistRow[]) => void;
  onSaveChecklist: () => void;
  onImportChecklist: (rows: ChecklistRow[]) => void;
  onClearChecklist: () => void;
};

export function StatusCardsRow(p: StatusCardsRowProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">SCI · Faturamento</CardTitle></CardHeader>
        <CardContent>
          {p.sci.length ? (
            <div className="text-sm space-y-1">
              <div>{p.sciSummary.totalClientes} clientes</div>
              <div className="text-muted-foreground">Faturamento total: <strong>{fmtBRL(p.sciSummary.totalGeral)}</strong></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Nenhum dado SCI importado ainda.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Acessórias · Gestão</CardTitle></CardHeader>
        <CardContent>
          {p.acc.length ? (
            <div className="text-sm space-y-1">
              <div>{p.accSummary.total} tarefas{p.excluirAtrasadas ? " (sem atrasadas)" : ""}</div>
              <div className="text-muted-foreground">Pontualidade: <strong>{p.accSummary.taxaPontualidade.toFixed(1)}%</strong></div>
              {p.checklistRespMapSize > 0 && (
                <div className="text-[11px] text-amber-600">Responsáveis substituídos pelo check-list</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Nenhum dado Acessórias importado ainda.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Check-list de empresas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {p.checklist.length ? (
            <div className="text-sm space-y-1">
              <div>{p.checklistSummary.total} empresas · {p.checklistSummary.ativos} ativas</div>
              <div className="text-muted-foreground text-xs">{p.checklistSummary.porResponsavel.length} responsáveis identificados</div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregue a planilha para mapear responsáveis por empresa.</p>
          )}
          <Button size="sm" variant="outline" onClick={() => p.checklistRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> {p.checklist.length ? "Substituir planilha" : "Importar planilha"}
          </Button>
          <input
            ref={p.checklistRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) p.onChecklistFile(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="pt-2">
            <DataPersistencePanel
              label="Check-list de empresas"
              fileSlug="checklist-empresas"
              data={p.checklist}
              hasData={p.checklist.length > 0}
              onSave={p.onSaveChecklist}
              onImport={(d) => {
                if (!Array.isArray(d)) return;
                p.onImportChecklist(d as ChecklistRow[]);
              }}
              onClear={p.onClearChecklist}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">SCI Protocolos</CardTitle></CardHeader>
        <CardContent>
          {p.protocolos.length ? (
            <div className="text-sm space-y-1">
              <div>{p.protocolosSummary.total} protocolos · {p.protocolosSummary.totalClientes} clientes</div>
              <div className="text-muted-foreground">Total impostos: <strong>{fmtBRL(p.protocolosSummary.valorTotalImpostos)}</strong></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Importe a planilha em SCI Protocolos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
