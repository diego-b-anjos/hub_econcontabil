// Utilitários de máscara monetária (pt-BR)
export function formatBRLInput(value: number): string {
  if (value == null || isNaN(value)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Converte string mascarada (ex.: "1.234,56" ou "R$ 1.234,56") em number
export function parseBRLInput(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// Máscara incremental: usuário digita apenas dígitos; convertemos para centavos.
export function maskMoneyTyping(raw: string): { display: string; value: number } {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return { display: "", value: 0 };
  const cents = parseInt(digits, 10);
  const value = cents / 100;
  return { display: formatBRLInput(value), value };
}
