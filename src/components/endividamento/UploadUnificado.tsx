import { useRef, useState } from "react";
import { Upload, FileText, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Tipos suportados pelo importador unificado. */
export type DetectedKind =
  | "rfb"
  | "darf"
  | "pgfn-regularize"
  | "pgfn-csv"
  | "sefaz-sp"
  | "pge-sp"
  | "cnd-sp"
  | "municipal-osasco"
  | "municipal-generico"
  | "estadual-generico"
  | "desconhecido";

const LABEL: Record<DetectedKind, string> = {
  "rfb": "Receita Federal — Situação Fiscal",
  "darf": "DARF — Receita Federal",
  "pgfn-regularize": "PGFN — Regularize (PDF)",
  "pgfn-csv": "PGFN — CSV consolidado",
  "sefaz-sp": "SEFAZ-SP — Pendências Fiscais",
  "pge-sp": "PGE-SP — Dívida Ativa Estadual (PDF/HTML)",
  "cnd-sp": "Prefeitura de São Paulo — CND",
  "municipal-osasco": "Prefeitura de Osasco/SP",
  "municipal-generico": "Municipal — layout genérico",
  "estadual-generico": "Estadual — layout genérico",
  "desconhecido": "Não foi possível detectar",
};

const OPCOES: { value: DetectedKind; label: string }[] = (
  Object.keys(LABEL) as DetectedKind[]
).map((k) => ({ value: k, label: LABEL[k] }));

/** Heurística leve por nome (e início do conteúdo para CSV). */
export function detectarPorNome(nome: string): DetectedKind {
  const n = nome.toLowerCase();
  if (n.endsWith(".csv")) {
    if (/pgfn|divida|consolidad/.test(n)) return "pgfn-csv";
    return "pgfn-csv";
  }
  if (/cnd|certidao|certid[ãa]o/.test(n)) {
    if (/s[ãa]o[\s_-]?paulo|sao_paulo|sp\b/.test(n)) return "cnd-sp";
  }
  if (/pge[\s_-]?sp|pge-?\d|dividaativa|divida[\s_-]?ativa|site[\s_-]?do[\s_-]?contribuinte/.test(n)) return "pge-sp";
  if (/sefaz|pend[eê]ncia|situacaofiscal-sefaz/.test(n)) return "sefaz-sp";
  if (/regularize|pgfn/.test(n)) return "pgfn-regularize";
  if (/\bdarf\b|documento[\s_-]?de[\s_-]?arrecadacao/.test(n)) return "darf";
  if (/situacao|situa[çc][ãa]o|sief|rfb|receita/.test(n)) return "rfb";
  if (/osasco/.test(n)) return "municipal-osasco";
  if (/cnd|certidao/.test(n)) return "cnd-sp";
  return "desconhecido";
}

export interface ArquivoDetectado {
  file: File;
  tipo: DetectedKind;
}

interface Props {
  onConfirm: (arquivos: ArquivoDetectado[]) => Promise<void> | void;
  busy?: boolean;
}

/**
 * Card de importação único: o usuário seleciona qualquer PDF/CSV reconhecido e o sistema
 * detecta automaticamente o tipo. Antes de confirmar, mostra uma lista expansível com
 * cada arquivo + tipo detectado, com opção de corrigir manualmente.
 */
export function UploadUnificado({ onConfirm, busy }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoDetectado[]>([]);
  const [aberto, setAberto] = useState(true);

  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    const aceitos = Array.from(files).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type === "text/html" ||
        /\.(pdf|csv|txt|html?|xhtml)$/i.test(f.name),
    );
    const novos: ArquivoDetectado[] = aceitos.map((f) => ({
      file: f,
      tipo: detectarPorNome(f.name),
    }));
    setArquivos((prev) => [...prev, ...novos]);
    setAberto(true);
    if (ref.current) ref.current.value = "";
  };

  const remover = (i: number) =>
    setArquivos((prev) => prev.filter((_, idx) => idx !== i));

  const alterarTipo = (i: number, tipo: DetectedKind) =>
    setArquivos((prev) => prev.map((a, idx) => (idx === i ? { ...a, tipo } : a)));

  const confirmar = async () => {
    if (!arquivos.length) return;
    const itens = arquivos;
    setArquivos([]);
    await onConfirm(itens);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer group",
          "hover:shadow-card border-primary/40 bg-primary/5 hover:border-primary",
          drag && "border-primary bg-primary/10 scale-[1.01]",
        )}
        onClick={() => ref.current?.click()}
      >
        <input
          ref={ref}
          type="file"
          accept="application/pdf,text/html,.pdf,.csv,.txt,.html,.htm,.xhtml"
          multiple
          hidden
          onChange={(e) => handle(e.target.files)}
        />
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              Importar relatórios fiscais
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Adicione PDFs, HTMLs ou CSVs de RFB, PGFN, SEFAZ-SP, PGE-SP, Prefeituras e Certidões.
              O tipo é detectado automaticamente — você pode revisar antes de confirmar.
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Arraste arquivos ou clique para selecionar
            </p>
          </div>
        </div>
      </div>

      {arquivos.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-border"
          >
            <span className="text-sm font-semibold">
              {arquivos.length} arquivo(s) detectado(s) — revise antes de importar
            </span>
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {aberto && (
            <ul className="divide-y divide-border">
              {arquivos.map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium truncate">{a.file.name}</span>
                  <Select
                    value={a.tipo}
                    onValueChange={(v: DetectedKind) => alterarTipo(i, v)}
                  >
                    <SelectTrigger className="h-8 w-[260px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCOES.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => remover(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-muted/40">
            <Button variant="outline" size="sm" onClick={() => setArquivos([])}>
              Limpar
            </Button>
            <Button size="sm" onClick={confirmar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}