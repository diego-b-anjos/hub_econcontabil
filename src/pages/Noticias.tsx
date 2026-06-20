import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Newspaper, RefreshCw, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Fontes RSS via rss2json ──────────────────────────────────────────────────

export interface RssSource {
  id: string;
  label: string;
  rssUrl: string;
  siteUrl: string;
  badgeClass: string;
}

export const RSS_SOURCES: RssSource[] = [
  {
    id: "contabeis-noticias",
    label: "Contábeis — Notícias",
    rssUrl: "https://www.contabeis.com.br/rss/noticias/",
    siteUrl: "https://www.contabeis.com.br/noticias",
    badgeClass: "bg-blue-100 text-blue-800",
  },
  {
    id: "contabeis-legislacao",
    label: "Contábeis — Legislação",
    rssUrl: "https://www.contabeis.com.br/rss/legislacao/",
    siteUrl: "https://www.contabeis.com.br/legislacao",
    badgeClass: "bg-sky-100 text-sky-800",
  },
  {
    id: "receita",
    label: "Receita Federal",
    rssUrl: "https://www.gov.br/receitafederal/RSS",
    siteUrl: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias",
    badgeClass: "bg-green-100 text-green-800",
  },
  {
    id: "sefaz-sp",
    label: "SEFAZ-SP",
    rssUrl: "https://www.sp.gov.br/sp/canais-comunicacao/noticias/RSS",
    siteUrl: "https://www.sp.gov.br/sp/canais-comunicacao/noticias",
    badgeClass: "bg-yellow-100 text-yellow-800",
  },
  {
    id: "cfc",
    label: "CFC",
    rssUrl: "https://cfc.org.br/feed/",
    siteUrl: "https://cfc.org.br",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  {
    id: "fenacon",
    label: "Fenacon",
    rssUrl: "https://fenacon.org.br/feed/",
    siteUrl: "https://fenacon.org.br",
    badgeClass: "bg-violet-100 text-violet-800",
  },
  {
    id: "tributario",
    label: "Portal Tributário",
    rssUrl: "https://portaltributario.com.br/feed/",
    siteUrl: "https://portaltributario.com.br",
    badgeClass: "bg-orange-100 text-orange-800",
  },
  {
    id: "jota",
    label: "JOTA",
    rssUrl: "https://www.jota.info/feed",
    siteUrl: "https://www.jota.info/tributos-e-empresas/tributario",
    badgeClass: "bg-red-100 text-red-800",
  },
];

const LINKS_OFICIAIS = [
  {
    label: "Receita Federal — Notícias",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias",
    badgeClass: "bg-blue-100 text-blue-800",
    desc: "Atos normativos, INs, despachos e comunicados da RFB.",
  },
  {
    label: "SEFAZ-SP — Notícias",
    url: "https://www.sp.gov.br/sp/canais-comunicacao/noticias",
    badgeClass: "bg-yellow-100 text-yellow-800",
    desc: "Legislação estadual paulista, ICMS, ST e comunicados da SEFAZ-SP.",
  },
  {
    label: "Diário Oficial da União",
    url: "https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados",
    badgeClass: "bg-gray-100 text-gray-700",
    desc: "Publicações oficiais federais — atos normativos e portarias.",
  },
  {
    label: "CVM — Comunicados",
    url: "https://www.gov.br/cvm/pt-br/assuntos/noticias",
    badgeClass: "bg-indigo-100 text-indigo-800",
    desc: "Normativas e comunicados da Comissão de Valores Mobiliários.",
  },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  thumbnail?: string;
  sourceId: string;
  sourceLabel: string;
  badgeClass: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_KEY = "econ_noticias_v4";
const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry { ts: number; items: NewsItem[]; failedSources: string[] }

function readCache(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const e: CacheEntry = JSON.parse(raw);
    if (Date.now() - e.ts > CACHE_TTL) return null;
    return e;
  } catch { return null; }
}
function writeCache(e: CacheEntry) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(e)); } catch { /* ignore */ }
}

// ─── Fetcher via rss2json.com ─────────────────────────────────────────────────

const RSS2JSON = "https://api.rss2json.com/v1/api.json";

async function fetchSource(src: RssSource): Promise<NewsItem[]> {
  const url = `${RSS2JSON}?rss_url=${encodeURIComponent(src.rssUrl)}&count=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "ok") throw new Error(json.message ?? "rss2json error");
  return (json.items ?? []).map((it: Record<string, string>, i: number) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = it.description ?? "";
    const summary = (tmp.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    return {
      id: `${src.id}-${i}-${it.link}`,
      title: it.title?.trim() ?? "(sem título)",
      link: it.link ?? src.siteUrl,
      pubDate: it.pubDate ?? "",
      summary,
      thumbnail: it.thumbnail || undefined,
      sourceId: src.id,
      sourceLabel: src.label,
      badgeClass: src.badgeClass,
    } satisfies NewsItem;
  });
}

export async function fetchAllNews(force = false): Promise<{ items: NewsItem[]; failedSources: string[] }> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  const results: NewsItem[] = [];
  const failed: string[] = [];
  await Promise.allSettled(
    RSS_SOURCES.map(async (src) => {
      try { results.push(...await fetchSource(src)); }
      catch { failed.push(src.id); }
    })
  );
  results.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });
  const entry = { ts: Date.now(), items: results, failedSources: failed };
  writeCache(entry);
  return entry;
}

export function formatNewsDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff <= 6) return `Há ${diff} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─── Componente NewsCard (exportado para reutilização no Dashboard) ────────────

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="group block h-full">
      <Card className="h-full hover:shadow-sm transition-shadow hover:border-primary/40 cursor-pointer overflow-hidden">
        {item.thumbnail && (
          <div className="h-32 overflow-hidden bg-muted">
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <CardContent className="p-4 flex flex-col gap-2 h-full">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${item.badgeClass}`}>
              {item.sourceLabel}
            </span>
            {item.pubDate && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatNewsDate(item.pubDate)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-3">
            {item.title}
          </p>
          {item.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
              {item.summary}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-primary mt-auto pt-1 opacity-60 group-hover:opacity-100 transition-opacity">
            Ler mais <ExternalLink className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Noticias() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [filterSource, setFilterSource] = useState<string>("todos");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const { items: news, failedSources: failed } = await fetchAllNews(force);
      setItems(news);
      setFailedSources(failed);
      setLastFetch(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = filterSource === "todos" ? items : items.filter((i) => i.sourceId === filterSource);
  const allFailed = !loading && items.length === 0 && failedSources.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Newspaper className="h-4 w-4" />
            <span>Notícias Contábeis</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Notícias do Setor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receita Federal, SEFAZ-SP, Contábeis, CFC, Fenacon e outros portais contábeis.
            {lastFetch && (
              <span className="ml-2 text-xs">
                Atualizado {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? "Buscando..." : "Atualizar"}
        </Button>
      </div>

      {/* Filtro por fonte */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-muted-foreground">Fonte:</span>
        {[{ id: "todos", label: `Todas (${items.length})` }, ...RSS_SOURCES.filter((s) => !failedSources.includes(s.id))].map((s) => {
          const count = s.id === "todos" ? items.length : items.filter((i) => i.sourceId === s.id).length;
          if (s.id !== "todos" && count === 0) return null;
          return (
            <button
              key={s.id}
              onClick={() => setFilterSource(s.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterSource === s.id ? "bg-black text-brand border-transparent" : "border-border hover:bg-muted"
              }`}
            >
              {s.id === "todos" ? s.label : `${s.label} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Buscando notícias...</span>
        </div>
      )}

      {/* Falha total */}
      {allFailed && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6 flex items-start gap-4">
            <WifiOff className="h-6 w-6 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Não foi possível buscar os feeds RSS</p>
              <p className="text-sm text-orange-700 mt-1">
                Pode ser bloqueio de rede, CORS ou indisponibilidade temporária. Acesse os sites diretamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de notícias */}
      {displayed.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((item) => <NewsCard key={item.id} item={item} />)}
        </div>
      )}

      {/* Fontes com falha */}
      {failedSources.length > 0 && !loading && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center pt-2 border-t">
          <span>Fontes offline:</span>
          {failedSources.map((id) => {
            const src = RSS_SOURCES.find((s) => s.id === id);
            return src ? (
              <a key={id} href={src.siteUrl} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5">
                {src.label} <ExternalLink className="h-3 w-3" />
              </a>
            ) : null;
          })}
        </div>
      )}

      {/* Portais oficiais */}
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Portais Oficiais</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {LINKS_OFICIAIS.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="group">
              <Card className="hover:shadow-sm transition-shadow hover:border-primary/40 h-full">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${link.badgeClass}`}>Oficial</span>
                      <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">{link.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
