import { useState, useEffect } from "react";
import { Pencil, Save, X, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Orgao } from "@/lib/endividamento/types";
import { orgaoLabel } from "@/lib/endividamento/format";

interface Props {
  versao: number;
  dataAtualizacao: string;
  datasPorOrgao: Partial<Record<Orgao, string>>;
  onChange: (patch: {
    versao?: number;
    dataAtualizacao?: string;
    datasPorOrgao?: Partial<Record<Orgao, string>>;
  }) => void;
}

const ORGAOS: Orgao[] = ["RFB", "PGFN", "Estadual", "Municipal"];

export function VersaoDatasEditor({ versao, dataAtualizacao, datasPorOrgao, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draftVersao, setDraftVersao] = useState(String(versao));
  const [draftData, setDraftData] = useState(dataAtualizacao);
  const [draftDatas, setDraftDatas] = useState<Partial<Record<Orgao, string>>>(datasPorOrgao);

  useEffect(() => {
    setDraftVersao(String(versao));
    setDraftData(dataAtualizacao);
    setDraftDatas(datasPorOrgao);
  }, [versao, dataAtualizacao, datasPorOrgao]);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 border-background/30 bg-background/10 text-background hover:bg-background/20 hover:text-background"
      >
        <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Versão & datas
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-background/20 bg-background/5 backdrop-blur-sm p-5 space-y-4 w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-background">Versão e datas dos relatórios</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraftVersao(String(versao));
              setDraftData(dataAtualizacao);
              setDraftDatas(datasPorOrgao);
              setOpen(false);
            }}
            className="h-8 text-background hover:bg-background/10 hover:text-background"
          >
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const v = Number(draftVersao);
              onChange({
                versao: Number.isFinite(v) && v > 0 ? Math.floor(v) : versao,
                dataAtualizacao: draftData,
                datasPorOrgao: draftDatas,
              });
              setOpen(false);
            }}
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-background/80">Nº da versão do endividamento</Label>
          <Input
            type="number"
            min={1}
            value={draftVersao}
            onChange={(e) => setDraftVersao(e.target.value)}
            className="h-9 bg-background/10 border-background/25 text-background placeholder:text-background/40 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-background/80">Data geral de atualização</Label>
          <Input
            value={draftData}
            onChange={(e) => setDraftData(e.target.value)}
            placeholder="dd/mm/aaaa hh:mm"
            className="h-9 bg-background/10 border-background/25 text-background placeholder:text-background/40 focus-visible:ring-primary"
          />
          <p className="text-[11px] text-background/60">
            Opcional. Se preferir, defina apenas as datas por ente abaixo —
            o relatório mostrará cada uma individualmente.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-background/70">
          Data por ente (de cada relatório)
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ORGAOS.map((o) => (
            <div key={o} className="space-y-1">
              <Label className="text-xs text-background/80">{orgaoLabel(o)}</Label>
              <div className="flex gap-2">
                <Input
                  value={draftDatas[o] || ""}
                  placeholder="dd/mm/aaaa"
                  onChange={(e) => setDraftDatas({ ...draftDatas, [o]: e.target.value })}
                  className="h-9 bg-background/10 border-background/25 text-background placeholder:text-background/40 focus-visible:ring-primary"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!draftDatas[o]}
                  onClick={() => draftDatas[o] && setDraftData(draftDatas[o] as string)}
                  className="h-9 px-2 text-[11px] text-background/80 hover:bg-background/10 hover:text-background"
                  title="Usar esta data como data geral"
                >
                  ↑ geral
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}