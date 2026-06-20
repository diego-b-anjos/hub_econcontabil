import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { SlideExtraItem } from "./types";

export type RemoverItemDialogProps = {
  removendoId: string | null;
  setRemovendoId: (v: string | null) => void;
  previewItem: SlideExtraItem | null;
  onConfirmar: () => void;
};

export function RemoverItemDialog({ removendoId, setRemovendoId, previewItem, onConfirmar }: RemoverItemDialogProps) {
  return (
    <AlertDialog open={!!removendoId} onOpenChange={(o) => !o && setRemovendoId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover este item?</AlertDialogTitle>
          <AlertDialogDescription>
            {previewItem?.kind === "file" ? (
              <>Você está prestes a remover o arquivo PPTX <strong>{previewItem.nome || previewItem.file.name}</strong>. Os slides desse arquivo não serão mesclados ao deck final. Será necessário fazer o upload novamente para usá-lo.</>
            ) : previewItem?.kind === "custom" ? (
              <>Você está prestes a remover o slide personalizado <strong>{previewItem.nome || previewItem.titulo || "(sem título)"}</strong>. O conteúdo digitado (título, subtítulo e corpo) será perdido.</>
            ) : (
              <>Esta ação não pode ser desfeita.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
