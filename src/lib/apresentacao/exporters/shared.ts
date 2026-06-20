// Constantes e helpers compartilhados entre os exporters da Apresentação
// Consolidada (PPTX/PDF/XLSX). Extraídos para evitar duplicação.

export const PPT_DARK = "1E1A16";
export const PPT_GOLD = "F7B831";
export const PPT_GRAY = "6E6E6E";
export const PPT_OK = "16A34A";
export const PPT_BAD = "DC2626";

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
