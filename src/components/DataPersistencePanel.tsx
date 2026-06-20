import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DataPersistencePanelProps {
  /** Identificador legível do dataset (usado em mensagens e nome do arquivo) */
  label: string;
  /** Slug curto para o nome do arquivo (ex.: "protocolos-sci") */
  fileSlug: string;
  /** Dados atuais a serem exportados / salvos */
  data: unknown;
  /** Habilita o botão "Salvar agora" e força a persistência (já é automática) */
  onSave?: () => void;
  /** Recebe o JSON importado pelo usuário */
  onImport: (data: unknown) => void;
  /** Limpa os dados do módulo */
  onClear: () => void;
  /** Indica se há dados (para habilitar/desabilitar botões) */
  hasData: boolean;
}

export function DataPersistencePanel({
  label, fileSlug, data, onSave, onImport, onClear, hasData,
}: DataPersistencePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!hasData) return toast.error("Nada para exportar.");
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url; a.download = `${fileSlug}-${ts}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`${label} exportado.`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar.");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      onImport(parsed);
      toast.success(`${label} importado de ${file.name}`);
    } catch (e) {
      console.error(e);
      toast.error("Arquivo JSON inválido.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSave && (
        <Button variant="outline" size="sm" onClick={onSave} disabled={!hasData}>
          <Save className="h-4 w-4 mr-2" /> Salvar agora
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handleExport} disabled={!hasData}>
        <Download className="h-4 w-4 mr-2" /> Exportar JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" /> Importar JSON
      </Button>
      <input
        ref={inputRef} type="file" accept="application/json,.json" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.currentTarget.value = "";
        }}
      />
      {hasData && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Limpar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                Os dados salvos neste navegador serão removidos. Exporte para JSON antes se quiser preservar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>Limpar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
