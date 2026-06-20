import type { RelatorioFiscal, Debito } from "./types";
import { fmtBRL, orgaoLabel } from "./format";

export interface ResumoLinha {
  orgao: string;
  imposto: string;
  qtdDebitos: number;
  principal: number;
  multa: number;
  juros: number;
  total: number;
}

const normalizaImposto = (receita: string, orgao?: Debito["orgao"]) => {
  const r = receita.toUpperCase();
  if (/SIMPLES NAC|SIMPLES\s/.test(r)) return "Simples Nacional";
  if (/CONTRIB[-\s]*PREV|INSS|PREVID/.test(r)) return "Contribuição Previdenciária (INSS)";
  if (/IRPJ/.test(r)) return "IRPJ";
  if (/CSLL/.test(r)) return "CSLL";
  if (/PIS/.test(r)) return "PIS";
  if (/COFINS/.test(r)) return "COFINS";
  if (/IRRF|IR FONTE/.test(r)) return "IR Retido na Fonte";
  if (/ICMS/.test(r)) return "ICMS";
  if (/ISS/.test(r)) return "ISS (Imposto Sobre Serviços)";
  // "Taxas Municipais" só faz sentido para débitos do órgão Municipal.
  // Para Estadual/RFB/PGFN, mantém o nome original do tributo (ex.: "Taxa
  // de Fiscalização Estadual") para evitar rotular como municipal.
  if (/TAXA/.test(r)) {
    if (orgao === "Municipal") return "Taxas Municipais";
    if (orgao === "Estadual") return "Taxas Estaduais";
    return receita;
  }
  return receita;
};

export function montarResumo(rel: RelatorioFiscal): ResumoLinha[] {
  const map = new Map<string, ResumoLinha>();
  rel.debitos.forEach((d: Debito) => {
    const imp = normalizaImposto(d.receita, d.orgao);
    const key = `${d.orgao}__${imp}`;
    const cur = map.get(key) || {
      orgao: orgaoLabel(d.orgao),
      imposto: imp,
      qtdDebitos: 0,
      principal: 0,
      multa: 0,
      juros: 0,
      total: 0,
    };
    cur.qtdDebitos += 1;
    cur.principal += d.valorOriginal;
    cur.multa += d.multa;
    cur.juros += d.juros;
    cur.total += d.total;
    map.set(key, cur);
  });
  return [...map.values()].sort(
    (a, b) => a.orgao.localeCompare(b.orgao) || b.total - a.total,
  );
}

export const explicacoesGlossario = [
  {
    titulo: "Principal (Valor Original)",
    texto:
      "É o valor do imposto que deveria ter sido pago na data de vencimento — sem nenhum acréscimo. É a 'dívida pura'.",
  },
  {
    titulo: "Multa",
    texto:
      "É a punição aplicada por não ter pago o imposto no prazo. Normalmente cresce conforme o atraso, até um teto definido por lei (em geral 20% do principal).",
  },
  {
    titulo: "Juros",
    texto:
      "É a correção pelo tempo em que o dinheiro deixou de ser pago, calculada com base na taxa Selic. Aumenta todo mês enquanto a dívida não for quitada.",
  },
  {
    titulo: "Total Atualizado",
    texto:
      "É a soma do Principal + Multa + Juros. Representa o valor real que precisa ser pago hoje para liquidar a dívida.",
  },
];

export function frasesExecutivas(rel: RelatorioFiscal, resumo: ResumoLinha[]): string[] {
  const totalDebitos = resumo.reduce((s, r) => s + r.total, 0);
  const principal = resumo.reduce((s, r) => s + r.principal, 0);
  const multa = resumo.reduce((s, r) => s + r.multa, 0);
  const juros = resumo.reduce((s, r) => s + r.juros, 0);
  const acrescimos = multa + juros;
  const parcAtraso = rel.parcelamentos.reduce(
    (s, p) => s + (p.valorEmAtraso || 0),
    0,
  );
  const total = totalDebitos + parcAtraso;
  const pct = total > 0 ? Math.round((acrescimos / total) * 100) : 0;

  const frases: string[] = [];
  frases.push(
    `Sua empresa possui hoje ${fmtBRL(total)} em dívidas tributárias consolidadas — ${fmtBRL(totalDebitos)} em ${rel.debitos.length} débito(s) em aberto e ${fmtBRL(parcAtraso)} em parcelas atrasadas de parcelamentos ativos.`,
  );
  frases.push(
    `Desse total, ${fmtBRL(principal)} é o imposto original (Principal) e ${fmtBRL(acrescimos)} são acréscimos legais (Multa + Juros) — ou seja, cerca de ${pct}% da dívida hoje é só penalidade pelo atraso.`,
  );
  if (parcAtraso > 0) {
    frases.push(
      `As ${fmtBRL(parcAtraso)} em parcelas atrasadas precisam ser regularizadas com urgência para evitar a rescisão do parcelamento e a inscrição em Dívida Ativa.`,
    );
  }
  const porOrgao = new Map<string, number>();
  resumo.forEach((r) => porOrgao.set(r.orgao, (porOrgao.get(r.orgao) || 0) + r.total));
  const ordenado = [...porOrgao.entries()].sort((a, b) => b[1] - a[1]);
  if (ordenado.length) {
    frases.push(
      `O órgão com maior dívida é ${ordenado[0][0]}, com ${fmtBRL(ordenado[0][1])}.`,
    );
  }
  return frases;
}