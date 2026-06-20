import type { InventoryItem, ClientData, InventoryMeta } from "./types";

function sanitizeText(text: string, maxLen: number): string {
  const cleaned = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ,.\-\/()]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned.substring(0, maxLen).trim();
}

function fv(value: number, decimals: number = 2): string {
  return value.toFixed(decimals).replace(".", ",");
}

function fd(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}${m}${y}`;
}

function padNCM(ncm: string): string {
  return ncm.replace(/[.\-\/\s]/g, "").padStart(8, "0");
}

function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function generate0000(client: ClientData, meta: InventoryMeta): string {
  const cnpj = cleanCNPJ(client.cnpj);
  return `|0000|${meta.versaoSped}|${client.codFinalidade || "0"}|${fd(meta.dataInicial)}|${fd(meta.dataFinal)}|${client.razaoSocial}|${cnpj}||${client.uf}|${client.inscricaoEstadual}|${client.codigoMunicipio}|||${client.perfil || "B"}|1|`;
}

function generate0001(): string { return "|0001|0|"; }

function generate0005(client: ClientData): string {
  return `|0005|${client.razaoSocial}|${client.cep}|${client.endereco}|${client.numero}|${client.complemento}|${client.bairro}|${client.telefone}||${client.email}|`;
}

function generate0100(client: ClientData): string {
  return `|0100|${sanitizeText(client.contabilistaNome, 100)}|${client.contabilistaCpf.replace(/\D/g, "")}|${client.contabilistaCrc}|${client.contabilistaCnpj.replace(/\D/g, "")}|${client.cep}|${sanitizeText(client.endereco, 60)}|${client.numero}|${sanitizeText(client.complemento, 60)}|${sanitizeText(client.bairro, 60)}|${client.telefone}||${client.email}|${client.codigoMunicipio}|`;
}

function generate0190(items: InventoryItem[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const item of items) {
    const un = item.unidade.toUpperCase();
    if (seen.has(un)) continue;
    seen.add(un);
    lines.push(`|0190|${un}|${un}|`);
  }
  return lines.join("\n");
}

export function generateRegistros0200(items: InventoryItem[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.codigo)) continue;
    seen.add(item.codigo);
    const ncm = padNCM(item.ncm);
    const codGen = ncm.substring(0, 2);
    const descricao = sanitizeText(item.descricao, 100);
    lines.push(`|0200|${item.codigo}|${descricao}|||${item.unidade}|00|${ncm}||${codGen}||||`);
  }
  return lines.join("\n");
}

function generate0990(totalLinhasBloco0: number): string {
  return `|0990|${totalLinhasBloco0 + 1}|`;
}

export function generateBloco0(items: InventoryItem[], meta: InventoryMeta, client: ClientData): string {
  const parts: string[] = [];
  parts.push(generate0000(client, meta));
  parts.push(generate0001());
  parts.push(generate0005(client));
  parts.push(generate0100(client));
  const r0190 = generate0190(items);
  if (r0190) parts.push(r0190);
  const r0200 = generateRegistros0200(items);
  if (r0200) parts.push(r0200);
  const totalLinhas = parts.join("\n").split("\n").length;
  parts.push(generate0990(totalLinhas));
  return parts.join("\n");
}

function generateBlocoVazio(letra: string): string {
  return `|${letra}001|1|\n|${letra}990|2|`;
}

function generateBlocoE(meta: InventoryMeta): string {
  const lines: string[] = [];
  lines.push("|E001|0|");
  lines.push(`|E100|${fd(meta.dataInicial)}|${fd(meta.dataFinal)}|`);
  lines.push(`|E110|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|${fv(0)}|`);
  lines.push(`|E990|${lines.length + 1}|`);
  return lines.join("\n");
}

function generateBloco1(): string {
  const lines: string[] = [];
  lines.push("|1001|0|");
  lines.push("|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|");
  lines.push(`|1990|${lines.length + 1}|`);
  return lines.join("\n");
}

export function generateBlocoH(items: InventoryItem[], meta: InventoryMeta, _client: ClientData): string {
  const lines: string[] = [];
  const dtInv = fd(meta.dataInventario);
  const totalEstoque = items.reduce((sum, item) => sum + item.valorTotal, 0);
  const defaultCta = meta.contaContabilPadrao || "";
  lines.push("|H001|0|");
  lines.push(`|H005|${dtInv}|${fv(totalEstoque)}|${meta.motivoInventario}|`);
  for (const item of items) {
    const cta = item.contaContabil || defaultCta;
    lines.push(`|H010|${item.codigo}|${item.unidade}|${fv(item.quantidade, 3)}|${fv(item.valorUnitario, 6)}|${fv(item.valorTotal)}|0|||${cta}||`);
  }
  const totalLinhas = lines.length + 1;
  lines.push(`|H990|${totalLinhas}|`);
  return lines.join("\n");
}

function generateBloco9(allLines: string[]): string {
  const lines: string[] = [];
  lines.push("|9001|0|");
  const regCount: Record<string, number> = {};
  for (const line of allLines) {
    const match = line.match(/^\|([A-Z0-9]{4})\|/);
    if (match) regCount[match[1]] = (regCount[match[1]] || 0) + 1;
  }
  const num9900Entries = Object.keys(regCount).length + 4;
  regCount["9001"] = 1;
  regCount["9900"] = num9900Entries;
  regCount["9990"] = 1;
  regCount["9999"] = 1;
  const sortedRegs = Object.keys(regCount).sort();
  for (const reg of sortedRegs) {
    lines.push(`|9900|${reg}|${regCount[reg]}|`);
  }
  const totalLinhasBloco9 = 1 + sortedRegs.length + 1;
  lines.push(`|9990|${totalLinhasBloco9 + 1}|`);
  const totalLinhasArquivo = allLines.length + lines.length + 1;
  lines.push(`|9999|${totalLinhasArquivo}|`);
  return lines.join("\n");
}

export function generateFullSped(items: InventoryItem[], meta: InventoryMeta, client: ClientData): string {
  const bloco0 = generateBloco0(items, meta, client);
  const blocoB = generateBlocoVazio("B");
  const blocoC = generateBlocoVazio("C");
  const blocoD = generateBlocoVazio("D");
  const blocoE = generateBlocoE(meta);
  const blocoG = generateBlocoVazio("G");
  const blocoH = generateBlocoH(items, meta, client);
  const blocoK = generateBlocoVazio("K");
  const bloco1 = generateBloco1();
  const allContent = [bloco0, blocoB, blocoC, blocoD, blocoE, blocoG, blocoH, blocoK, bloco1].join("\n");
  const partialLines = allContent.split("\n");
  const bloco9 = generateBloco9(partialLines);
  return allContent + "\n" + bloco9 + "\n";
}
