import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const SLIDES = [
  ["capa", "Capa institucional"],
  ["sciVisao", "SCI · Indicadores e gráficos"],
  ["sciPorMes", "SCI · Faturamento mensal"],
  ["sciPorPlano", "SCI · Por plano tributário"],
  ["sciClientes", "SCI · Top 10 clientes"],
  ["accVisao", "Acessórias · KPIs + competência"],
  ["accObrigacoes", "Acessórias · Obrigações"],
  ["accResponsaveis", "Acessórias · Por responsável"],
  ["accEmpresasCriticas", "Acessórias · Empresas críticas"],
  ["checklistResp", "Check-list · Carteira por responsável"],
  ["protocolosVisao", "SCI Protocolos · Visão geral"],
  ["protocolosCategorias", "SCI Protocolos · Categorias (Decl./Mem./Imp.)"],
  ["protocolosResponsavel", "SCI Protocolos · Por responsável (impostos)"],
  ["protocolosReferencia", "SCI Protocolos · Por referência (impostos)"],
  ["protocolosClientes", "SCI Protocolos · Top clientes (impostos)"],
  ["textoLivre", "Mensagem personalizada"],
  ["encerramento", "Encerramento"],
] as const;

export type SlidesOpts = Record<(typeof SLIDES)[number][0], boolean>;

export function SlidesSelectorCard({
  opts,
  setOpts,
}: {
  opts: SlidesOpts;
  setOpts: (updater: (prev: SlidesOpts) => SlidesOpts) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Slides do deck</CardTitle></CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-2">
        {SLIDES.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <Checkbox checked={opts[k]} onCheckedChange={(v) => setOpts((p) => ({ ...p, [k]: !!v }))} />
            {l}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
