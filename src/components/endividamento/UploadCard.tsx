import { useRef, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description: string;
  accent?: "primary" | "dark";
  onFiles: (files: File[]) => Promise<void> | void;
}

export function UploadCard({ title, description, accent = "primary", onFiles }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      await onFiles(Array.from(files).filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf")));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      className={cn(
        "relative rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer group",
        "hover:shadow-card",
        accent === "primary" ? "border-primary/40 bg-primary/5 hover:border-primary" : "border-secondary/30 bg-secondary/5 hover:border-secondary",
        drag && "border-primary bg-primary/10 scale-[1.01]",
      )}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept="application/pdf" multiple hidden onChange={(e) => handle(e.target.files)} />
      <div className="flex items-start gap-4">
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
          accent === "primary" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        )}>
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Arraste PDFs ou clique para selecionar
          </p>
        </div>
      </div>
    </div>
  );
}
