// Utilitário para salvar JSON no localStorage com mensagens de erro úteis.
import { toast } from "sonner";

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export function safeSaveJSON(entries: Record<string, unknown>, label = "Dados"): boolean {
  let totalSize = 0;
  try {
    for (const [key, value] of Object.entries(entries)) {
      const str = JSON.stringify(value ?? null);
      totalSize += str.length;
      localStorage.setItem(key, str);
    }
    toast.success(`${label} salvos (${fmtBytes(totalSize)}).`);
    return true;
  } catch (e: any) {
    console.error("[safeSaveJSON]", e);
    const isQuota =
      e?.name === "QuotaExceededError" ||
      e?.code === 22 ||
      /quota/i.test(String(e?.message || ""));
    if (isQuota) {
      toast.error(
        `Espaço de armazenamento do navegador esgotado (${fmtBytes(totalSize)}). Exporte para JSON e limpe outros módulos.`,
        { duration: 8000 },
      );
    } else {
      toast.error(`Falha ao salvar ${label.toLowerCase()}: ${e?.message || "erro desconhecido"}`);
    }
    return false;
  }
}
