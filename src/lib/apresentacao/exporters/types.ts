export type SlideExtraItem =
  | { id: string; kind: "file"; file: File; position: "start" | "end"; nome?: string }
  | {
      id: string;
      kind: "custom";
      titulo: string;
      subtitulo: string;
      corpo: string;
      layout: "capa" | "conteudo" | "encerramento";
      corFundo: "escuro" | "claro" | "dourado";
      position: "start" | "end";
      nome?: string;
    }
  | { id: string; kind: "system"; position: "start" | "end"; nome?: string };
