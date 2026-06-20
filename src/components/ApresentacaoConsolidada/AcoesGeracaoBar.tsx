import { Button } from "@/components/ui/button";
import { Download, Eye, FileSpreadsheet, FileText, Loader2, Presentation } from "lucide-react";

export type AcoesGeracaoBarProps = {
  semDados: boolean;
  carregandoPreview: boolean;
  onPdf: () => void;
  onExcel: () => void;
  onPreview: () => void;
  onPptx: () => void;
};

export function AcoesGeracaoBar(p: AcoesGeracaoBarProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="lg" onClick={p.onPdf} disabled={p.semDados}>
        <FileText className="w-5 h-5 mr-2" />
        Exportar PDF
      </Button>
      <Button variant="outline" size="lg" onClick={p.onExcel} disabled={p.semDados}>
        <FileSpreadsheet className="w-5 h-5 mr-2" />
        Exportar Excel
      </Button>
      <Button variant="outline" size="lg" onClick={p.onPreview} disabled={p.semDados || p.carregandoPreview}>
        {p.carregandoPreview ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Eye className="w-5 h-5 mr-2" />}
        Pré-visualizar
      </Button>
      <Button size="lg" onClick={p.onPptx} disabled={p.semDados}>
        <Presentation className="w-5 h-5 mr-2" />
        Gerar PPTX
        <Download className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
