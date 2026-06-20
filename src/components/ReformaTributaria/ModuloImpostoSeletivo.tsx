import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, Download, Info, Search } from "lucide-react";
import { IMPOSTO_SELETIVO } from "@/constants/tax-tables";

export interface AliquotasCustom {
  ibsRef: number;
  cbsRef: number;
  isOverrides: Record<string, number>;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function exportIsCSV(overrides: Record<string, number>) {
  const rows = [
    ["NCM", "Produto", "Categoria", "Alíquota IS (%)", "Base Legal"],
    ...IMPOSTO_SELETIVO.map((i) => [
      i.ncm,
      i.nome,
      i.categoria,
      (overrides[i.ncm] ?? i.aliquota).toString().replace(".", ","),
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

const CATEGORIA_COLORS: Record<string, string> = {
  "Tabaco":                  "border-l-slate-600",
  "Bebidas Alcoólicas":      "border-l-amber-500",
  "Bebidas Açucaradas":      "border-l-orange-400",
  "Veículos":                "border-l-blue-500",
  "Embarcações e Aeronaves": "border-l-sky-500",
  "Armas e Munições":        "border-l-red-600",
  "Mineração":               "border-l-stone-500",
};

interface Props {
  aliquotasCustom: AliquotasCustom;
}

export default function ModuloImpostoSeletivo({ aliquotasCustom }: Props) {
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

  const grupos = useMemo(() => {
    const map = new Map<string, typeof IMPOSTO_SELETIVO>();
    for (const item of itensFiltrados) {
      if (!map.has(item.categoria)) map.set(item.categoria, []);
      map.get(item.categoria)!.push(item);
    }
    return map;
  }, [itensFiltrados]);

  const calcResultado = useMemo(() => {
    const q = calcNcm.toLowerCase().trim();
    if (!q) return null;
    const item = IMPOSTO_SELETIVO.find(
      (i) => i.ncm.toLowerCase() === q || i.nome.toLowerCase().includes(q),
    );
    if (!item) return { item: null };
    const aliquota = aliquotasCustom.isOverrides[item.ncm] ?? item.aliquota;
    const valor = parseFloat(calcValor.replace(",", ".")) || 0;
    return { item, aliquota, is: (valor * aliquota) / 100, baseCalculo: valor };
  }, [calcNcm, calcValor, aliquotasCustom.isOverrides]);

  return (
    <div className="space-y-6">
      {/* Descrição */}
      <Card className="border-amber-100 bg-amber-50">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 leading-relaxed">
            O <strong>Imposto Seletivo (IS)</strong> incide sobre bens e serviços considerados prejudiciais à saúde ou ao
            meio ambiente, conforme o <strong>Art. 74 da LC 214/2025</strong> e <strong>EC 132/2023</strong>. As alíquotas
            abaixo são as de referência estabelecidas na lei complementar. Veículos, embarcações e aeronaves podem ter
            ajustes pelo regulamento do IBS.
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportIsCSV(aliquotasCustom.isOverrides)}
              className="gap-1.5 h-8"
            >
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
                  <span className="text-xs text-muted-foreground ml-2">
                    ({itens.length} item{itens.length !== 1 ? "s" : ""})
                  </span>
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
                    {itens.map((item) => {
                      const alq = aliquotasCustom.isOverrides[item.ncm] ?? item.aliquota;
                      const isOverridden = aliquotasCustom.isOverrides[item.ncm] !== undefined;
                      return (
                        <tr
                          key={item.ncm}
                          className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setCalcNcm(item.ncm)}
                        >
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{item.ncm}</td>
                          <td className="px-4 py-2 text-xs">{item.nome}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={`font-bold text-sm ${
                                isOverridden ? "text-purple-600" :
                                alq >= 50 ? "text-red-600" :
                                alq >= 15 ? "text-amber-600" :
                                "text-foreground"
                              }`}
                            >
                              {alq}%{isOverridden && " ✏"}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-[9px] font-semibold border-muted-foreground/30 text-muted-foreground">
                              Art. 74, LC 214/2025
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
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
                <p className="text-[10px] text-muted-foreground">
                  Clique em uma linha da tabela para selecionar automaticamente.
                </p>
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
                    <span className="font-bold text-base text-primary">{calcResultado.aliquota}%</span>
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
                  <Badge
                    variant="outline"
                    className="text-[9px] w-full justify-center border-muted-foreground/30 text-muted-foreground"
                  >
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
