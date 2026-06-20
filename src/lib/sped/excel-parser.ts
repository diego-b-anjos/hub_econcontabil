import * as XLSX from "xlsx";
import type { InventoryItem, ValidationWarning } from "./types";

function normalizeHeader(header: string): string {
  return header
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeTextCell(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeader(header: string): keyof InventoryItem | null {
  const h = normalizeHeader(header);
  if (h.includes("codigo") || h === "cod" || h === "code") return "codigo";
  if (h.includes("descricao") || h.includes("descr") || h === "produto") return "descricao";
  if (h.includes("ncm")) return "ncm";
  if (h.includes("unidade") || h === "un" || h === "und" || h === "unid") return "unidade";
  if (h.includes("quantidade") || h === "qtd" || h === "qtde" || h === "qty") return "quantidade";
  if (h.includes("unitario") || h.includes("unit") || h.includes("vl_unit") || h.includes("preco")) return "valorUnitario";
  if (h.includes("total") || h.includes("vl_total")) return "valorTotal";
  if (h.includes("conta") || h.includes("contabil") || h.includes("cta")) return "contaContabil";
  return null;
}

function isValidNCM(ncm: string): boolean {
  const clean = ncm.replace(/[.\-\/\s]/g, "");
  if (clean.length === 0) return false;
  if (clean.length !== 8) return false;
  if (!/^\d{8}$/.test(clean)) return false;
  if (clean === "00000000") return false;
  return true;
}

function getHeaderKey(headerMap: Record<string, keyof InventoryItem>, field: keyof InventoryItem): string {
  return Object.keys(headerMap).find(k => headerMap[k] === field) || "";
}

export interface ParseResult {
  items: InventoryItem[];
  warnings: ValidationWarning[];
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (jsonData.length === 0) {
          reject(new Error("Planilha vazia"));
          return;
        }

        const firstRow = jsonData[0];
        const headerMap: Record<string, keyof InventoryItem> = {};
        for (const key of Object.keys(firstRow)) {
          const mapped = mapHeader(key);
          if (mapped) headerMap[key] = mapped;
        }

        const items: InventoryItem[] = [];
        const warnings: ValidationWarning[] = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const linha = i + 2;

          const codigo = normalizeTextCell(row[getHeaderKey(headerMap, "codigo")]);
          if (!codigo) continue;

          const descricao = normalizeTextCell(row[getHeaderKey(headerMap, "descricao")]);
          const descLower = descricao.toLowerCase().trim();
          if (/^total(\s|$)/.test(descLower) || /^total\s+geral/.test(descLower) || descLower === "total") continue;

          const ncmRaw = normalizeTextCell(row[getHeaderKey(headerMap, "ncm")]).replace(/[.\-\/\s]/g, "");
          const unidade = normalizeTextCell(row[getHeaderKey(headerMap, "unidade")]).toUpperCase();
          const quantidade = Number(row[getHeaderKey(headerMap, "quantidade")] ?? 0);
          const valorUnitario = Number(row[getHeaderKey(headerMap, "valorUnitario")] ?? 0);
          const valorTotal = Number(row[getHeaderKey(headerMap, "valorTotal")] ?? 0);
          const contaContabil = normalizeTextCell(row[getHeaderKey(headerMap, "contaContabil")]);

          if (!descricao.trim()) warnings.push({ linha, campo: "Descrição", mensagem: `Linha ${linha}: Descrição vazia para o código ${codigo}` });
          if (!isValidNCM(ncmRaw)) warnings.push({ linha, campo: "NCM", mensagem: `Linha ${linha}: NCM inválido "${ncmRaw}" para o código ${codigo} (deve ter 8 dígitos numéricos)` });
          if (!unidade) warnings.push({ linha, campo: "Unidade", mensagem: `Linha ${linha}: Unidade não informada para o código ${codigo}` });
          if (quantidade <= 0) warnings.push({ linha, campo: "Quantidade", mensagem: `Linha ${linha}: Quantidade inválida (${quantidade}) para o código ${codigo}` });
          if (valorUnitario <= 0) warnings.push({ linha, campo: "Valor Unitário", mensagem: `Linha ${linha}: Valor unitário inválido para o código ${codigo}` });
          if (valorTotal <= 0) warnings.push({ linha, campo: "Valor Total", mensagem: `Linha ${linha}: Valor total inválido para o código ${codigo}` });

          const item: InventoryItem = {
            codigo, descricao, ncm: ncmRaw, unidade, quantidade, valorUnitario, valorTotal, contaContabil,
          };

          if (item.codigo && item.descricao) items.push(item);
        }

        if (items.length === 0) {
          reject(new Error("Nenhum item válido encontrado. Verifique se as colunas estão corretas: Código, Descrição, NCM, Unidade, Quantidade, Valor Unitário, Valor Total"));
          return;
        }

        resolve({ items, warnings });
      } catch (err) {
        reject(new Error("Erro ao processar o arquivo Excel: " + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
