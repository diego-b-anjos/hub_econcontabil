// Lê um Blob/ArrayBuffer .pptx e retorna lista ordenada de slides com
// um título estimado (primeiro texto encontrado no slide XML).
import JSZip from "jszip";

export interface PptxSlideInfo {
  index: number;       // 1-based
  path: string;        // ex.: "ppt/slides/slide3.xml"
  titulo: string;      // primeiro texto detectado (ou "(sem texto)")
  resumo: string;      // até ~120 chars dos primeiros textos
}

const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

export async function listPptxSlides(src: Blob | ArrayBuffer): Promise<PptxSlideInfo[]> {
  const buf = src instanceof Blob ? await src.arrayBuffer() : src;
  const zip = await JSZip.loadAsync(buf);
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  const presRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!presXml || !presRels) return [];

  const relMap = new Map<string, string>();
  presRels.replace(/<Relationship\s+([^/]+)\/>/g, (_m, attrs) => {
    const id = /Id="([^"]+)"/.exec(attrs)?.[1];
    const target = /Target="([^"]+)"/.exec(attrs)?.[1];
    const type = /Type="([^"]+)"/.exec(attrs)?.[1];
    if (id && target && type?.endsWith("/slide")) relMap.set(id, target);
    return "";
  });
  const ordered = [...presXml.matchAll(/<p:sldId[^/]*r:id="([^"]+)"/g)]
    .map((m) => relMap.get(m[1]))
    .filter(Boolean) as string[];

  const out: PptxSlideInfo[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const path = `ppt/${ordered[i]}`;
    const xml = (await zip.file(path)?.async("string")) || "";
    const textos: string[] = [];
    xml.replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g, (_m, t) => {
      const clean = stripTags(t);
      if (clean) textos.push(clean);
      return "";
    });
    const titulo = textos[0] || "(sem texto)";
    const resumo = textos.slice(0, 6).join(" · ").slice(0, 140);
    out.push({ index: i + 1, path, titulo, resumo });
  }
  return out;
}
