import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CapaCardProps = {
  nomeCapa: string;
  setNomeCapa: (v: string) => void;
  dataCapa: string;
  setDataCapa: (v: string) => void;
};

export function CapaCard({ nomeCapa, setNomeCapa, dataCapa, setDataCapa }: CapaCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Capa da apresentação</CardTitle></CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome a exibir na capa</Label>
          <Input
            placeholder="Ex.: Cliente XYZ · Reunião mensal"
            value={nomeCapa}
            onChange={(e) => setNomeCapa(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Substitui o subtítulo padrão "Visão consolidada · SCI + Acessórias".
          </p>
        </div>
        <div>
          <Label className="text-xs">Data da apresentação</Label>
          <Input
            type="date"
            value={dataCapa}
            onChange={(e) => setDataCapa(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Aparece no rodapé da capa em formato por extenso (ex.: 29 de abril de 2026).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
