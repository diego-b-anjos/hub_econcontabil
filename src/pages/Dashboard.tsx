import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiClients, apiSimulations, type Simulation } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Bell, CalendarDays, ExternalLink, FileBarChart2, Newspaper } from "lucide-react";
import { DateWeatherWidget } from "@/components/DateWeatherWidget";
import {
  APP_MODULES,
  MODULE_CATEGORIES,
  modulesByCategory,
  type AppModule,
} from "@/config/modules";
import { obrigacoesDoMes, type Obrigacao } from "@/data/tributos";
import { fetchAllNews, type NewsItem } from "@/pages/Noticias";

// ─── Gradientes temáticos por módulo ─────────────────────────────────────────

const MODULE_GRADIENTS: Record<string, string> = {
  // Tributário
  simulacoes:          "from-blue-700 via-blue-800 to-indigo-900",
  "apuracao-trimestral": "from-indigo-600 via-blue-800 to-blue-900",
  "beneficio-fiscal":  "from-sky-600 via-cyan-700 to-blue-900",
  "reforma-tributaria":"from-violet-600 via-purple-800 to-indigo-900",
  // Fiscal
  calendario:          "from-emerald-600 via-teal-700 to-green-900",
  envidamento:         "from-teal-600 via-emerald-800 to-cyan-900",
  sped:                "from-green-600 via-teal-700 to-emerald-900",
  "painel-alertas":    "from-orange-500 via-amber-600 to-orange-900",
  "dre-simplificada":  "from-lime-600 via-green-700 to-teal-900",
  // Geral
  cadastros:           "from-amber-500 via-yellow-600 to-orange-800",
  integracoes:         "from-zinc-500 via-slate-700 to-zinc-900",
  "links-uteis":       "from-cyan-600 via-sky-700 to-blue-900",
  noticias:            "from-rose-500 via-red-600 to-pink-900",
  perfil:              "from-slate-600 via-gray-700 to-zinc-900",
};

const CATEGORY_GRADIENT: Record<string, string> = {
  Tributário: "from-blue-700 via-blue-800 to-indigo-900",
  Fiscal:     "from-emerald-600 via-teal-700 to-green-900",
  Geral:      "from-amber-500 via-yellow-600 to-orange-800",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ clients: 0, sims: 0 });
  const [recentSims, setRecentSims] = useState<Simulation[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiClients.count().catch(() => ({ count: 0 })),
      apiSimulations.count().catch(() => ({ count: 0 })),
      apiSimulations.list().catch(() => []),
    ]).then(([c, s, sims]) => {
      setStats({ clients: c.count, sims: s.count });
      const list = Array.isArray(sims) ? sims : [];
      setRecentSims([...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
    });
    // Fetch news in background — don't block the page
    fetchAllNews().then(({ items }) => setNews(items.slice(0, 4))).catch(() => { /* silent */ });
  }, [user]);

  const agora = new Date();
  const mesAtual = agora.getMonth() + 1;
  const anoAtual = agora.getFullYear();
  const proximasObrigacoes = useMemo((): Obrigacao[] => {
    const obrigacoes = obrigacoesDoMes(mesAtual);
    const hoje = agora.getDate();
    const proximas = obrigacoes
      .filter((o) => new Date(anoAtual, mesAtual - 1, o.dia) >= new Date(anoAtual, mesAtual - 1, hoje))
      .sort((a, b) => a.dia - b.dia)
      .slice(0, 3);
    return proximas.length > 0 ? proximas : obrigacoes.sort((a, b) => a.dia - b.dia).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesAtual]);

  const displayName = (user?.name || user?.email || "").trim();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Bem-vindo,</div>
          <h1 className="text-3xl font-display font-bold">{displayName || "Contador"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Hub do escritório — todos os módulos em um só lugar.</p>
        </div>
        <div className="shrink-0 pt-1">
          <DateWeatherWidget />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatBox label="Clientes" value={stats.clients} to="/app/clientes" />
        <StatBox label="Simulações" value={stats.sims} to="/app/simulacoes" />
        <StatBox
          label="Módulos ativos"
          value={`${APP_MODULES.filter((m) => m.status === "active" && !m.isGroup).length} / ${APP_MODULES.filter((m) => !m.isGroup).length}`}
          small
        />
      </div>

      {/* Próximas obrigações + Simulações recentes */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Próximas obrigações — {new Date(anoAtual, mesAtual - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proximasObrigacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma obrigação encontrada.</p>
            ) : (
              proximasObrigacoes.map((o) => {
                const isHoje = o.dia === agora.getDate();
                return (
                  <div key={o.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isHoje ? "bg-orange-500 text-white" : "bg-brand/20 text-foreground"}`}>
                      {o.dia}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{o.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.descricao}</p>
                    </div>
                    {isHoje && <Badge className="text-[9px] bg-orange-500 text-white shrink-0">Hoje</Badge>}
                  </div>
                );
              })
            )}
            <Link to="/app/calendario" className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
              Ver calendário completo <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4 text-primary" />
              Simulações recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSims.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma simulação cadastrada ainda.</p>
            ) : (
              recentSims.map((s) => (
                <Link key={s.id} to={`/app/simulacoes/${s.id}`}
                  className="flex items-center gap-3 py-1.5 border-b last:border-0 hover:bg-muted/50 rounded px-1 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.year} · {s.snAnnex} · {s.clients?.name || "Sem cliente"}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
            <Link to="/app/simulacoes" className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
              Ver todas as simulações <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Acesso rápido — Painel de Alertas */}
      <Link to="/app/painel-alertas" className="block">
        <Card className="border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer">
          <CardContent className="flex items-center gap-3 py-4">
            <Bell className="h-5 w-5 text-orange-600 shrink-0" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">Painel de Alertas</p>
              <p className="text-xs text-orange-600">Veja os vencimentos dos próximos 30 dias de todos os clientes.</p>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-600 ml-auto shrink-0" />
          </CardContent>
        </Card>
      </Link>

      {/* Notícias recentes */}
      {news.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <Newspaper className="h-5 w-5" /> Notícias do Setor
            </h2>
            <Link to="/app/noticias" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {news.map((item) => (
              <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
                <Card className="h-full hover:shadow-sm transition-shadow hover:border-primary/40 overflow-hidden">
                  {item.thumbnail && (
                    <div className="h-24 overflow-hidden bg-muted">
                      <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  <CardContent className="p-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.badgeClass}`}>{item.sourceLabel}</span>
                    <p className="text-xs font-semibold mt-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <ExternalLink className="h-2.5 w-2.5" /> Ler mais
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Módulos por categoria */}
      {MODULE_CATEGORIES.map((cat) => {
        const items = modulesByCategory(cat).filter(
          (m) => m.id !== "dashboard" && m.id !== "clientes" && !m.parentId,
        );
        if (items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-display font-bold">{cat}</h2>
              <div className="text-xs text-muted-foreground">
                {items.filter((i) => i.status === "active").length} ativo(s) · {items.length} total
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((m) => <ModuleCard key={m.id} module={m} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Module Card com gradientes temáticos ─────────────────────────────────────

function ModuleCard({ module: m }: { module: AppModule }) {
  const Icon = m.icon;
  const disabled = m.status === "coming-soon";
  const gradient = MODULE_GRADIENTS[m.id] ?? CATEGORY_GRADIENT[m.category] ?? "from-brand/60 to-brand/20";

  const inner = (
    <Card className={`group relative overflow-hidden transition-all h-full border-border/60 bg-card ${
      disabled ? "opacity-75 hover:opacity-90" : "hover:shadow-elegant hover:-translate-y-1 hover:border-brand cursor-pointer"
    }`}>
      {/* Gradient header */}
      <div className="relative h-28 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        {/* Big icon as subtle decoration */}
        <div className="absolute -right-3 -bottom-3 opacity-[0.12] pointer-events-none">
          <Icon className="w-28 h-28 text-white" />
        </div>
        {/* Bottom vignette */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Badge */}
        <div className="absolute top-3 right-3 z-10">
          {disabled ? (
            <Badge variant="secondary" className="text-[10px] bg-black/70 text-white border-0">Em breve</Badge>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-bold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
              {m.category}
            </span>
          )}
        </div>
        {/* Accent bar on hover */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 z-10" />
      </div>

      {/* Floating icon */}
      <div className="absolute top-[5.25rem] left-4 w-12 h-12 rounded-xl bg-card border-2 border-brand flex items-center justify-center shadow-md text-brand group-hover:bg-brand group-hover:text-brand-foreground transition-colors z-20">
        <Icon className="w-5 h-5" />
      </div>

      <CardContent className="relative p-5 pt-9 flex flex-col gap-2 min-h-[140px]">
        <div className="font-display font-bold text-base leading-snug">{m.label}</div>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{m.description}</p>
        {!disabled && (
          <div className="flex items-center text-xs font-semibold text-brand mt-1 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
            Acessar <ArrowRight className="w-3 h-3 ml-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  return disabled ? inner : <Link to={m.to} className="block h-full">{inner}</Link>;
}

function StatBox({ label, value, to, small }: { label: string; value: string | number; to?: string; small?: boolean }) {
  const inner = (
    <Card className="hover:shadow-elegant transition-shadow">
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</div>
        <div className={small ? "text-lg font-display font-bold mt-1" : "text-3xl font-display font-bold mt-1"}>{value}</div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
