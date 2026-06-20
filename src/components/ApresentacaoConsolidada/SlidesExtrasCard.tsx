import type { Dispatch, RefObject, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { SlideExtraItem } from "./types";

export type SlidesExtrasCardProps = {
  slidesExtras: SlideExtraItem[];
  setSlidesExtras: Dispatch<SetStateAction<SlideExtraItem[]>>;
  slidesExtrasRef: RefObject<HTMLInputElement>;
  editandoId: string | null;
  setEditandoId: (v: string | null) => void;
  setRemovendoId: (v: string | null) => void;
  renomearItem: (id: string, nome: string) => void;
};

export function SlidesExtrasCard(p: SlidesExtrasCardProps) {
  const { slidesExtras, setSlidesExtras, slidesExtrasRef, editandoId, setEditandoId, setRemovendoId, renomearItem } = p;
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Slides adicionais (opcional)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Faça upload de arquivos <strong>.pptx</strong>, crie slides personalizados ou adicione a <strong>Apresentação do Sistema</strong> à lista para definir sua posição (início/fim) junto aos demais. Sem esse item, a apresentação do sistema é a base e os extras vão no início ou fim.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => slidesExtrasRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Adicionar PPTX
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const id = Math.random().toString(36).slice(2);
            setSlidesExtras((prev) => [...prev, { id, kind: "custom", titulo: "Apresentação Executiva", subtitulo: "Visão consolidada · SCI + Acessórias", corpo: "", layout: "capa", corFundo: "escuro", position: "start" }]);
            setEditandoId(id);
          }}>
            <Sparkles className="w-3 h-3 mr-1" /> Criar capa
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            const id = Math.random().toString(36).slice(2);
            setSlidesExtras((prev) => [...prev, { id, kind: "custom", titulo: "Slide personalizado", subtitulo: "", corpo: "Escreva aqui o conteúdo do slide.", layout: "conteudo", corFundo: "claro", position: "end" }]);
            setEditandoId(id);
          }}>
            <FileText className="w-3 h-3 mr-1" /> Criar slide
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            if (slidesExtras.some((x) => x.kind === "system")) {
              toast.info("A Apresentação do Sistema já está na ordenação.");
              return;
            }
            const id = Math.random().toString(36).slice(2);
            setSlidesExtras((prev) => [...prev, { id, kind: "system", position: "end" }]);
            toast.success("Apresentação do Sistema adicionada à ordenação.");
          }}>
            <FileText className="w-3 h-3 mr-1" /> Adicionar Apresentação do Sistema
          </Button>
          {slidesExtras.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSlidesExtras([])}>Limpar tudo</Button>
          )}
          <input
            ref={slidesExtrasRef} type="file" accept=".pptx" multiple className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files || []);
              if (fs.length) setSlidesExtras((prev) => [...prev, ...fs.map((f) => ({ id: Math.random().toString(36).slice(2), kind: "file" as const, file: f, position: "end" as const }))]);
              e.currentTarget.value = "";
            }}
          />
        </div>
        {slidesExtras.length > 0 && (
          <ul className="space-y-2">
            {slidesExtras.map((it, i) => {
              const move = (dir: -1 | 1) => setSlidesExtras((prev) => {
                const next = [...prev]; const j = i + dir;
                if (j < 0 || j >= next.length) return prev;
                [next[i], next[j]] = [next[j], next[i]]; return next;
              });
              const setPos = (pos: "start" | "end") => setSlidesExtras((prev) => prev.map((x, idx) => idx === i ? { ...x, position: pos } : x));
              const isEditing = editandoId === it.id && it.kind === "custom";
              const labelDefault = it.kind === "file" ? it.file.name : it.kind === "system" ? "Apresentação do Sistema" : (it.titulo || "Sem título");
              const labelExibido = it.nome || labelDefault;
              const badgeLabel = it.kind === "file" ? "PPTX" : it.kind === "system" ? "Sistema" : it.layout === "capa" ? "Capa" : it.layout === "encerramento" ? "Encerramento" : "Conteúdo";
              return (
                <li key={it.id} className="border rounded-md p-2 bg-card">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right">{i + 1}.</span>
                    <Badge variant="outline" className="text-[10px]">{badgeLabel}</Badge>
                    <Input
                      value={labelExibido}
                      onChange={(e) => renomearItem(it.id, e.target.value)}
                      className="h-7 text-xs flex-1"
                      title={`Renomear (padrão: ${labelDefault})`}
                    />
                    {it.kind === "file" && (
                      <span className="text-muted-foreground text-[10px] whitespace-nowrap">{(it.file.size / 1024).toFixed(0)} KB</span>
                    )}
                    <select
                      className="text-xs border rounded px-1 py-0.5 bg-background"
                      value={it.position}
                      onChange={(e) => setPos(e.target.value as "start" | "end")}
                      title="Posição no deck final"
                    >
                      <option value="start">Início</option>
                      <option value="end">Fim</option>
                    </select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(-1)} disabled={i === 0} title="Mover para cima">↑</Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(1)} disabled={i === slidesExtras.length - 1} title="Mover para baixo">↓</Button>
                    {it.kind === "custom" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditandoId(isEditing ? null : it.id)} title={isEditing ? "Fechar editor" : "Editar"}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setRemovendoId(it.id)} title="Remover">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {isEditing && it.kind === "custom" && (
                    <div className="mt-3 grid md:grid-cols-2 gap-2 border-t pt-3">
                      <div>
                        <Label className="text-xs">Título</Label>
                        <Input value={it.titulo} onChange={(e) => setSlidesExtras((prev) => prev.map((x) => x.id === it.id && x.kind === "custom" ? { ...x, titulo: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label className="text-xs">Subtítulo</Label>
                        <Input value={it.subtitulo} onChange={(e) => setSlidesExtras((prev) => prev.map((x) => x.id === it.id && x.kind === "custom" ? { ...x, subtitulo: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label className="text-xs">Layout</Label>
                        <select className="w-full text-sm border rounded h-9 px-2 bg-background"
                          value={it.layout}
                          onChange={(e) => setSlidesExtras((prev) => prev.map((x) => x.id === it.id && x.kind === "custom" ? { ...x, layout: e.target.value as "capa" | "conteudo" | "encerramento" } : x))}>
                          <option value="capa">Capa</option>
                          <option value="conteudo">Conteúdo</option>
                          <option value="encerramento">Encerramento</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Cor de fundo</Label>
                        <select className="w-full text-sm border rounded h-9 px-2 bg-background"
                          value={it.corFundo}
                          onChange={(e) => setSlidesExtras((prev) => prev.map((x) => x.id === it.id && x.kind === "custom" ? { ...x, corFundo: e.target.value as "escuro" | "claro" | "dourado" } : x))}>
                          <option value="escuro">Escuro (institucional)</option>
                          <option value="claro">Claro</option>
                          <option value="dourado">Dourado</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs">Texto / corpo</Label>
                        <Textarea rows={4} value={it.corpo} onChange={(e) => setSlidesExtras((prev) => prev.map((x) => x.id === it.id && x.kind === "custom" ? { ...x, corpo: e.target.value } : x))} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
