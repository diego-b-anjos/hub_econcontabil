import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug, Upload, FileSpreadsheet, Presentation, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import sciLogo from "@/assets/integracoes/sci-logo.jpg";
import acessoriasLogo from "@/assets/integracoes/acessorias-logo.png";

interface SubModulo {
  id: string;
  nome: string;
  descricao: string;
  bg: string;
  bgBlend: "screen" | "multiply" | "luminosity" | "normal";
  bgOpacity: number;
  acentoDe: string; // hex/hsl
  acentoPara: string;
  acoes: { label: string; to: string; icon: React.ReactNode; primary?: boolean }[];
}

const SUBMODULOS: SubModulo[] = [
  {
    id: "sci",
    nome: "SCI",
    descricao: "Sistema Contábil Integrado — leitura da planilha de faturamento da carteira para gerar resumos, gráficos e relatórios executivos.",
    bg: sciLogo,
    bgBlend: "screen", // logo tem fundo preto, screen elimina o preto e mantém o olho azul
    bgOpacity: 0.55,
    acentoDe: "#0B1B3D",
    acentoPara: "#1E3A6A",
    acoes: [
      { label: "Faturamento da carteira", to: "/app/integracoes/sci/faturamento", icon: <FileSpreadsheet className="w-4 h-4 mr-1.5" />, primary: true },
      { label: "Protocolos", to: "/app/integracoes/sci/protocolos", icon: <FileSpreadsheet className="w-4 h-4 mr-1.5" /> },
    ],
  },
  {
    id: "acessorias",
    nome: "Acessórias",
    descricao: "Comunicação e tarefas com clientes — importa o relatório de Gestão de Entregas para acompanhar pontualidade, atrasos e produtividade.",
    bg: acessoriasLogo,
    bgBlend: "luminosity", // logo "A" dourado em fundo branco; luminosity preserva forma sem clarear demais o card
    bgOpacity: 0.45,
    acentoDe: "#1E1A16",
    acentoPara: "#5C4A2E",
    acoes: [
      { label: "Gestão de Entregas", to: "/app/integracoes/acessorias/gestao-entregas", icon: <Upload className="w-4 h-4 mr-1.5" />, primary: true },
    ],
  },
];

export default function Integracoes() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Conectividade</div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Integrações de Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte a plataforma aos sistemas que o escritório já utiliza. Cada cartão abre o submódulo dedicado para
          importação, análise e relatórios.
        </p>
      </div>

      {/* Atalho Apresentação */}
      <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-[#1E1A16] to-[#3a2f24] text-white">
        <div className="flex items-center justify-between p-5 md:p-6 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-[#F7B831]/15 p-3 border border-[#F7B831]/30">
              <Presentation className="w-6 h-6 text-[#F7B831]" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#F7B831] font-semibold">Consolidado</div>
              <div className="font-display text-lg md:text-xl font-bold">Apresentação Executiva</div>
              <p className="text-xs md:text-sm text-white/70 mt-0.5">
                Unifica em um único deck os dados do SCI e da Acessórias.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-[#F7B831] text-[#1E1A16] hover:bg-[#F7B831]/90"
            onClick={() => navigate("/app/integracoes/apresentacao")}>
            Abrir módulo <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        {SUBMODULOS.map((s) => {
          const principal = s.acoes.find((a) => a.primary) || s.acoes[0];
          return (
            <Card
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(principal.to)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(principal.to); }}
              className="group relative overflow-hidden cursor-pointer border-border/60 hover:border-primary/40 transition-all hover:shadow-elegant focus:outline-none focus:ring-2 focus:ring-ring h-[260px]"
            >
              {/* Fundo escuro de base */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${s.acentoDe} 0%, ${s.acentoPara} 100%)`,
                }}
                aria-hidden="true"
              />
              {/* Logo do sistema como marca d'água */}
              <div
                className="absolute -right-6 -bottom-6 w-[260px] h-[260px] bg-no-repeat bg-contain bg-right-bottom pointer-events-none"
                style={{
                  backgroundImage: `url(${s.bg})`,
                  opacity: s.bgOpacity,
                  mixBlendMode: s.bgBlend,
                }}
                aria-hidden="true"
              />
              {/* Vinheta para legibilidade do texto à esquerda */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${s.acentoDe}f0 0%, ${s.acentoDe}80 50%, transparent 100%)`,
                }}
                aria-hidden="true"
              />

              {/* Conteúdo */}
              <div className="relative h-full flex flex-col justify-between p-5 md:p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    <Plug className="w-3 h-3" /> Submódulo
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div>
                  <h2 className="font-display text-3xl md:text-4xl font-bold drop-shadow-md">{s.nome}</h2>
                  <p className="text-xs md:text-sm text-white/85 mt-2 max-w-md leading-snug">{s.descricao}</p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {s.acoes.map((a) => (
                      <Button
                        key={a.label}
                        size="sm"
                        variant={a.primary ? "default" : "outline"}
                        className={a.primary
                          ? "bg-white text-foreground hover:bg-white/90"
                          : "bg-white/10 border-white/30 text-white hover:bg-white/20"}
                        onClick={(e) => { e.stopPropagation(); navigate(a.to); }}
                      >
                        {a.icon} {a.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
