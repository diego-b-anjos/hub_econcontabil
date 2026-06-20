// Mescla slides de arquivos .pptx adicionais a um Blob/ArrayBuffer base
// gerado pelo PptxGenJS. Estratégia: copia os slides (XML, rels, mídia) dos
// arquivos extras para dentro do pacote base, atualizando referências de
// numeração (slide{N}.xml) e o presentation.xml + presentation.xml.rels e
// [Content_Types].xml. Implementação client-side com JSZip.
import JSZip from "jszip";

export type MergeSource = ArrayBuffer | Blob;

async function loadZip(src: MergeSource): Promise<JSZip> {
  const buf = src instanceof Blob ? await src.arrayBuffer() : src;
  return JSZip.loadAsync(buf);
}

// Lê e parseia um XML como string
const readText = (z: JSZip, p: string) => z.file(p)?.async("string");

function nextIndex(prefix: string, suffix: string, files: string[]): number {
  const re = new RegExp(`^${prefix}(\\d+)${suffix.replace(/\./g, "\\.")}$`);
  let max = 0;
  for (const f of files) {
    const m = f.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export type MergeItem = { source: MergeSource; position?: "start" | "end" | number };

export async function mergePptx(baseBlob: Blob, extras: (MergeSource | MergeItem)[]): Promise<Blob> {
  if (!extras.length) return baseBlob;
  const base = await loadZip(baseBlob);

  // Normaliza
  const items: MergeItem[] = extras.map((e) =>
    e && typeof e === "object" && "source" in (e as any) ? (e as MergeItem) : { source: e as MergeSource, position: "end" }
  );

  for (const item of items) {
    const src = await loadZip(item.source);
    const position = item.position ?? "end";

    const presXml = await readText(src, "ppt/presentation.xml");
    const presRels = await readText(src, "ppt/_rels/presentation.xml.rels");
    if (!presXml || !presRels) continue;

    const relMap = new Map<string, string>();
    presRels.replace(/<Relationship\b([^>]*?)\/>/g, (_m, attrs) => {
      const id = /Id="([^"]+)"/.exec(attrs)?.[1];
      const target = /Target="([^"]+)"/.exec(attrs)?.[1];
      const type = /Type="([^"]+)"/.exec(attrs)?.[1];
      if (id && target && type?.endsWith("/slide")) relMap.set(id, target);
      return "";
    });

    const sldIds = [...presXml.matchAll(/<p:sldId[^/]*r:id="([^"]+)"/g)].map((m) => m[1]);
    const slidePaths = sldIds.map((id) => relMap.get(id)).filter(Boolean) as string[];

    const baseFiles = Object.keys(base.files);
    let insertedFromThisFile = 0;

    for (const relPath of slidePaths) {
      const srcSlidePath = `ppt/${relPath}`;
      const slideXml = await readText(src, srcSlidePath);
      if (!slideXml) continue;
      const srcSlideRelsPath = `ppt/slides/_rels/${relPath.split("/").pop()}.rels`;
      const slideRelsXml = (await readText(src, srcSlideRelsPath)) || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

      const newIdx = nextIndex("ppt/slides/slide", ".xml", Object.keys(base.files));
      const newSlidePath = `ppt/slides/slide${newIdx}.xml`;
      const newSlideRelsPath = `ppt/slides/_rels/slide${newIdx}.xml.rels`;

      const newRelsXml = await rewriteSlideRels(slideRelsXml, src, base, baseFiles);
      base.file(newSlidePath, slideXml);
      base.file(newSlideRelsPath, newRelsXml);

      const ctPath = "[Content_Types].xml";
      const ct = await readText(base, ctPath);
      if (ct && !ct.includes(`PartName="/${newSlidePath}"`)) {
        const override = `<Override PartName="/${newSlidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        base.file(ctPath, ct.replace("</Types>", `${override}</Types>`));
      }

      const baseRelsPath = "ppt/_rels/presentation.xml.rels";
      const basePresRels = (await readText(base, baseRelsPath)) || "";
      const relIds = [...basePresRels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
      const newRelNum = (relIds.length ? Math.max(...relIds) : 0) + 1;
      const newRelId = `rId${newRelNum}`;
      const newRel = `<Relationship Id="${newRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${newIdx}.xml"/>`;
      base.file(baseRelsPath, basePresRels.replace("</Relationships>", `${newRel}</Relationships>`));

      const basePresPath = "ppt/presentation.xml";
      const basePres = (await readText(base, basePresPath)) || "";
      const sldIdNums = [...basePres.matchAll(/<p:sldId[^/]*id="(\d+)"/g)].map((m) => Number(m[1]));
      const newSldId = (sldIdNums.length ? Math.max(...sldIdNums, 255) : 256) + 1;
      const newSldEntry = `<p:sldId id="${newSldId}" r:id="${newRelId}"/>`;

      // Insere o sldId na posição desejada dentro de <p:sldIdLst>
      const updatedPres = basePres.replace(/(<p:sldIdLst>)([\s\S]*?)(<\/p:sldIdLst>)/, (_m, open, body, close) => {
        const entries = [...body.matchAll(/<p:sldId[^/]*\/>/g)].map((mm) => mm[0]);
        let insertAt: number;
        if (position === "start") insertAt = insertedFromThisFile; // mantém ordem dos slides do mesmo arquivo
        else if (position === "end") insertAt = entries.length;
        else insertAt = Math.max(0, Math.min(entries.length, position + insertedFromThisFile));
        entries.splice(insertAt, 0, newSldEntry);
        return `${open}${entries.join("")}${close}`;
      });
      base.file(basePresPath, updatedPres);
      insertedFromThisFile++;
    }
  }

  return base.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

// Reescreve os Targets do .rels do slide copiando arquivos referenciados
// (mídia, embeds e slideLayout) para dentro do base.
async function rewriteSlideRels(relsXml: string, src: JSZip, base: JSZip, baseFiles: string[]): Promise<string> {
  const relRegex = /<Relationship\b([^>]*?)\/>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  const header = relsXml.slice(0, relsXml.indexOf("<Relationship"));
  const footer = relsXml.slice(relsXml.lastIndexOf("</Relationships>"));
  while ((m = relRegex.exec(relsXml)) !== null) {
    const attrs = m[1];
    const id = /Id="([^"]+)"/.exec(attrs)?.[1] || "";
    const type = /Type="([^"]+)"/.exec(attrs)?.[1] || "";
    let target = /Target="([^"]+)"/.exec(attrs)?.[1] || "";
    const mode = /TargetMode="([^"]+)"/.exec(attrs)?.[1];
    if (mode === "External" || !target) {
      out.push(m[0]);
      lastIndex = relRegex.lastIndex;
      continue;
    }
    // Resolve caminho absoluto do alvo dentro do src
    const srcAbs = resolvePath("ppt/slides/", target);
    const file = src.file(srcAbs);
    if (!file) {
      out.push(m[0]);
      continue;
    }
    // Para slideLayout, reusa o primeiro layout existente do base (compatibilidade básica)
    if (type.endsWith("/slideLayout")) {
      const baseLayout = baseFiles.find((f) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(f));
      if (baseLayout) {
        const newTarget = "../" + baseLayout.replace("ppt/", "");
        out.push(`<Relationship Id="${id}" Type="${type}" Target="${newTarget}"/>`);
        continue;
      }
    }
    // Mídia/embeds: copia para nome único no base
    const ext = srcAbs.split(".").pop() || "bin";
    const folder = srcAbs.includes("/media/") ? "ppt/media/" : srcAbs.includes("/embeddings/") ? "ppt/embeddings/" : "ppt/media/";
    const prefix = folder + "imported_";
    const idxRe = new RegExp(`^${prefix.replace(/\//g, "\\/")}(\\d+)\\.`);
    let nextNum = 1;
    for (const f of Object.keys(base.files)) {
      const mm = f.match(idxRe);
      if (mm) nextNum = Math.max(nextNum, Number(mm[1]) + 1);
    }
    const newAbs = `${prefix}${nextNum}.${ext}`;
    const data = await file.async("uint8array");
    base.file(newAbs, data);
    // Adiciona Default no Content Types se necessário
    const ctPath = "[Content_Types].xml";
    const ct = (await readText(base, ctPath)) || "";
    if (!new RegExp(`Extension="${ext}"`, "i").test(ct)) {
      const mime = mimeFor(ext);
      const def = `<Default Extension="${ext}" ContentType="${mime}"/>`;
      base.file(ctPath, ct.replace("<Types ", "<Types ").replace("</Types>", `${def}</Types>`));
    }
    const newTarget = "../" + newAbs.replace("ppt/", "");
    out.push(`<Relationship Id="${id}" Type="${type}" Target="${newTarget}"/>`);
  }
  return `${header}${out.join("")}${footer}`;
}

function resolvePath(baseDir: string, rel: string): string {
  const parts = (baseDir + rel).split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p && p !== ".") stack.push(p);
  }
  return stack.join("/");
}

function mimeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "gif") return "image/gif";
  if (e === "svg") return "image/svg+xml";
  if (e === "webp") return "image/webp";
  if (e === "bmp") return "image/bmp";
  if (e === "emf") return "image/x-emf";
  if (e === "wmf") return "image/x-wmf";
  if (e === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (e === "xml") return "application/xml";
  return "application/octet-stream";
}
