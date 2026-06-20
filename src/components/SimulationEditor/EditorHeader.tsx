import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Save } from "lucide-react";

export type EditorHeaderProps = {
  name: string;
  saving: boolean;
  onBack: () => void;
  onExport: () => void;
  onSave: () => void;
};

export function EditorHeader({ name, saving, onBack, onExport, onSave }: EditorHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Simulação tributária</div>
          <h1 className="text-xl md:text-2xl font-display font-bold break-words">{name || "Nova simulação"}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <FileDown className="w-4 h-4 mr-2" /> Exportar relatório
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
