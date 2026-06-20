import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Calculator, FileCode, Download, Info } from "lucide-react";
import { IMPOSTO_SELETIVO, MAPEAMENTO_CST_CLASSTRIB } from "@/constants/tax-tables";
// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CST_LABELS: Record<string, { label: string; color: string }> = {
  "000": { label: "Tributação Integral",     color: "bg-red-100 text-red-800 border-red-200" },
  "010": { label: "Alíquotas Uniformes",     color: "bg-blue-100 text-blue-800 border-blue-200" },
  "200": { label: "Alíquota Reduzida",       color: "bg-amber-100 text-amber-800 border-amber-200" },
  "410": { label: "Imunidade",               color: "bg-green-100 text-green-800 border-green-200" },
};

// Export IS table to CSV
function exportIsCSV() {
  const rows = [
    ["NCM", "Produto", "Categoria", "Alíquota IS (%)", "Base Legal"],
    ...IMPOSTO_SELETIVO.map((i) => [
      i.ncm,
      i.nome,
      i.categoria,
      i.aliquota.toString().replace(".", ","),
      i.observacao ?? "LC 214/2025 Art. 74",
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "imposto-seletivo-lc214-2025.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Mapeamento CST ────────────────────────────────────────────────────────────

function MapeamentoCSTTab() {
  const [busca, setBusca] = useState("");
  const [filtroCst, setFiltroCst] = useState<string>("todos");

  const cstOptions = ["todos", "000", "010", "200", "410"];

  const entries = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return Object.entries(MAPEAMENTO_CST_CLASSTRIB)
      .filter(([classtrib, item]) => {
        const matchCst = filtroCst === "todos" || item.cst === filtroCst;
        const matchBusca =
          !q ||
          classtrib.includes(q) ||
          item.cst.includes(q) ||
          item.desc.toLowerCase().includes(q);
        return matchCst && matchBusca;
      })
      .sort((a, b) => a[1].cst.localeCompare(b[1].cst) || a[0].localeCompare(b[0]));
  }, [busca, filtroCst]);

  return (
    <div className="space-y-4">
      {/* Descrição */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            O <strong>CST IBS/CBS</strong> (Código de Situação Tributária) identifica o tratamento fiscal de cada operação no novo IVA Dual.
            A <strong>ClassTrib</strong> é o código interno do Comitê Gestor que mapeia cada situação para o CST correspondente, conforme a
            <strong> LC 214/2025</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-52 space-y-1">
          <Label className="text-xs">Buscar por código ou descrição</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Ex: 200003, educação, imunidade…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cstOptions.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCst(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filtroCst === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c === "todos" ? "Todos" : `CST ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">ClassTrib</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">CST</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Situação</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    Nenhum resultado encontrado.
                  </td>
                </tr>
              ) : (
                entries.map(([classtrib, item]) => {
                  const badge = CST_LABELS[item.cst] ?? { label: item.cst, color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={classtrib} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{classtrib}</td>
                      <td className="px-4 py-2.5 font-mono font-bold">{item.cst}</td>
                      <td className="px-4 py-2.5 text-xs">{item.desc}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
          {entries.length} registro(s) encontrado(s) · Fonte: LC 214/2025 + Comitê Gestor do IBS
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CST_LABELS).map(([cst, info]) => (
          <div key={cst} className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium ${info.color}`}>
            <span className="font-mono font-bold">{cst}</span>
            <span>·</span>
            <span>{info.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Imposto Seletivo ──────────────────────────────────────────────────────────

function ImpostoSeletivoTab() {
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [calcNcm, setCalcNcm] = useState("");
  const [calcValor, setCalcValor] = useState("");

  const categorias = useMemo(
    () => ["todas", ...Array.from(new Set(IMPOSTO_SELETIVO.map((i) => i.categoria)))],
    [],
  );

  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return IMPOSTO_SELETIVO.filter((i) => {
      const matchCat = filtroCategoria === "todas" || i.categoria === filtroCategoria;
      const matchQ = !q || i.ncm.toLowerCase().includes(q) || i.nome.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [busca, filtroCategoria]);

  // Agrupar por categoria para renderização
  const grupos = useMemo(() => {
    const map = new Map<string, typeof IMPOSTO_SELETIVO>();
    for (const item of itensFiltrados) {
      if (!map.has(item.categoria)) map.set(item.categoria, []);
      map.get(item.categoria)!.push(item);
    }
    return map;
  }, [itensFiltrados]);

  // Calculadora IS
  const calcResultado = useMemo(() => {
    const q = calcNcm.toLowerCase().trim();
    if (!q) return null;
    const item = IMPOSTO_SELETIVO.find(
      (i) => i.ncm.toLowerCase() === q || i.nome.toLowerCase().includes(q),
    );
    if (!item) return { item: null };
    const valor = parseFloat(calcValor.replace(",", ".")) || 0;
    return { item, is: (valor * item.aliquota) / 100, baseCalculo: valor };
  }, [calcNcm, calcValor]);

  const CATEGORIA_COLORS: Record<string, string> = {
    "Tabaco":                  "border-l-slate-600",
    "Bebidas Alcoólicas":      "border-l-amber-500",
    "Bebidas Açucaradas":      "border-l-orange-400",
    "Veículos":                "border-l-blue-500",
    "Embarcações e Aeronaves": "border-l-sky-500",
    "Armas e Munições":        "border-l-red-600",
    "Mineração":               "border-l-stone-500",
  };

  return (
    <div className="space-y-6">
      {/* Descrição */}
      <Card className="border-amber-100 bg-amber-50">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 leading-relaxed">
            O <strong>Imposto Seletivo (IS)</strong> incide sobre bens e serviços considerados prejudiciais à saúde ou ao meio ambiente,
            conforme o <strong>Art. 74 da LC 214/2025</strong> e <strong>EC 132/2023</strong>. As alíquotas abaixo são as de referência
            estabelecidas na lei complementar. Veículos, embarcações e aeronaves podem ter ajustes pelo regulamento do IBS.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna esquerda — tabela */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-52 space-y-1">
              <Label className="text-xs">Buscar por NCM ou produto</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Ex: 2402, cigarro, cerveja…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={exportIsCSV} className="gap-1.5 h-8">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>

          {/* Filtro por categoria */}
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setFiltroCategoria(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filtroCategoria === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {c === "todas" ? "Todas" : c}
              </button>
            ))}
          </div>

          {/* Tabela agrupada */}
          {grupos.size === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum item encontrado.</p>
          ) : (
            Array.from(grupos.entries()).map(([cat, itens]) => (
              <div key={cat} className="rounded-md border overflow-hidden">
                <div className={`px-4 py-2 bg-muted/50 border-b border-l-4 ${CATEGORIA_COLORS[cat] ?? "border-l-primary"}`}>
                  <span className="font-semibold text-sm">{cat}</span>
                  <span className="text-xs text-muted-foreground ml-2">({itens.length} item{itens.length !== 1 ? "s" : ""})</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide">NCM</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide">Produto</th>
                      <th className="text-right px-4 py-2 font-semibold text-xs uppercase tracking-wide">Alíquota IS</th>
                      <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide">Base Legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item) => (
                      <tr
                        key={item.ncm}
                        className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setCalcNcm(item.ncm)}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{item.ncm}</td>
                        <td className="px-4 py-2 text-xs">{item.nome}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`font-bold text-sm ${item.aliquota >= 50 ? "text-red-600" : item.aliquota >= 15 ? "text-amber-600" : "text-foreground"}`}>
                            {item.aliquota}%
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[9px] font-semibold border-muted-foreground/30 text-muted-foreground">
                            Art. 74, LC 214/2025
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {/* Coluna direita — calculadora */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Calculadora IS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">NCM ou nome do produto</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder="Ex: 2402, cigarro…"
                    value={calcNcm}
                    onChange={(e) => setCalcNcm(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Clique em uma linha da tabela para selecionar automaticamente.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Valor da operação (R$)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Ex: 10000,00"
                  value={calcValor}
                  onChange={(e) => setCalcValor(e.target.value)}
                />
              </div>

              {calcResultado === null ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Informe um NCM ou nome de produto para calcular.
                </p>
              ) : calcResultado.item === null ? (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  NCM ou produto não encontrado na tabela do IS (LC 214/2025).
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Produto</p>
                    <p className="font-medium text-xs leading-snug">{calcResultado.item.nome}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Categoria</span>
                    <span className="text-xs font-medium">{calcResultado.item.categoria}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Alíquota IS</span>
                    <span className="font-bold text-base text-primary">{calcResultado.item.aliquota}%</span>
                  </div>
                  {calcResultado.baseCalculo > 0 && (
                    <>
                      <hr />
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Base de cálculo</span>
                        <span className="text-xs">{formatCurrency(calcResultado.baseCalculo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-semibold">IS apurado</span>
                        <span className="font-bold text-primary">{formatCurrency(calcResultado.is)}</span>
                      </div>
                    </>
                  )}
                  <Badge variant="outline" className="text-[9px] w-full justify-center border-muted-foreground/30 text-muted-foreground">
                    Base legal: Art. 74, LC 214/2025
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function MapeamentoTributario() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
          <FileCode className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">CST IBS/CBS e IS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mapeamento de CST IBS/CBS (LC 214/2025) e calculadora do Imposto Seletivo.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cst">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cst" className="gap-1.5">
            <FileCode className="h-3.5 w-3.5" /> Mapeamento CST
          </TabsTrigger>
          <TabsTrigger value="is" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> Imposto Seletivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cst" className="mt-6">
          <MapeamentoCSTTab />
        </TabsContent>

        <TabsContent value="is" className="mt-6">
          <ImpostoSeletivoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
