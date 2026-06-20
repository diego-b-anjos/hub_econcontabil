import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ClienteOption = { key: string; label: string; cnpj?: string };

export type FiltroClienteCardProps = {
  clienteFiltro: string;
  setClienteFiltro: (v: string) => void;
  clientesDisponiveis: ClienteOption[];
  counts: {
    sci: number;
    acc: number;
    checklist: number;
    protocolos: number;
    endiv: number;
    apuracao: number;
    sped: number;
    pgdas: number;
  };
};

export function FiltroClienteCard({ clienteFiltro, setClienteFiltro, clientesDisponiveis, counts }: FiltroClienteCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filtro por cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-6">
          <Label className="text-xs">Cliente</Label>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Geral (todos os clientes)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Geral">Geral · Todos os clientes</SelectItem>
              {clientesDisponiveis.map((c) => (
                <SelectItem key={c.key} value={c.label}>
                  {c.label}{c.cnpj ? ` · ${c.cnpj}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Quando um cliente é selecionado, <strong>todos os módulos</strong> (SCI, Acessórias, Check-list,
            Protocolos, Endividamento, Apuração Trimestral, SPED e PGDAS-D) são filtrados por nome ou CNPJ
            correspondente. Use "Geral" para a visão consolidada da carteira.
          </p>
        </div>
        <div className="md:col-span-6">
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="font-semibold uppercase tracking-wider text-muted-foreground">
              Dados após filtro {clienteFiltro !== "Geral" && <Badge variant="secondary" className="ml-2">{clienteFiltro}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>SCI: <strong>{counts.sci}</strong> linhas</div>
              <div>Acessórias: <strong>{counts.acc}</strong> tarefas</div>
              <div>Check-list: <strong>{counts.checklist}</strong> empresas</div>
              <div>Protocolos: <strong>{counts.protocolos}</strong> registros</div>
              <div>Endividamento: <strong>{counts.endiv}</strong> snapshots</div>
              <div>Apuração Trim.: <strong>{counts.apuracao}</strong> trimestres</div>
              <div>SPED hist.: <strong>{counts.sped}</strong></div>
              <div>PGDAS-D hist.: <strong>{counts.pgdas}</strong></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
