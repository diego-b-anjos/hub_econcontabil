import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye } from "lucide-react";
import type { PptxSlideInfo } from "@/lib/pptx-preview";

export type PreviewDeckDialogProps = {
  previewSlides: PptxSlideInfo[] | null;
  setPreviewSlides: (v: PptxSlideInfo[] | null) => void;
  onBaixar: () => void;
};

export function PreviewDeckDialog({ previewSlides, setPreviewSlides, onBaixar }: PreviewDeckDialogProps) {
  return (
    <Dialog open={!!previewSlides} onOpenChange={(o) => !o && setPreviewSlides(null)}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Eye className="w-5 h-5" /> Prévia do deck final
            {previewSlides && <Badge variant="secondary" className="ml-2">{previewSlides.length} slides</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {previewSlides && previewSlides.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum slide encontrado no deck.</p>
          )}
          <ol className="space-y-2">
            {previewSlides?.map((s) => (
              <li key={s.index} className="border rounded-md p-3 flex gap-3">
                <div className="w-12 h-9 rounded bg-gradient-to-br from-[#1E1A16] to-[#2a221c] text-[#F7B831] flex items-center justify-center font-bold text-sm shrink-0">
                  {s.index}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{s.titulo}</div>
                  {s.resumo && s.resumo !== s.titulo && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.resumo}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setPreviewSlides(null)}>Fechar</Button>
          <Button onClick={() => { setPreviewSlides(null); onBaixar(); }}>
            <Download className="w-4 h-4 mr-2" /> Baixar PPTX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
