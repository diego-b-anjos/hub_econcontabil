import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useCbenefStore } from "@/store/cbenefStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImportExcelProps {
  type: "empresas" | "beneficios";
}

const ImportExcel = ({ type }: ImportExcelProps) => {
  const { addEmpresas, addBeneficios } = useCbenefStore();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      if (data.length > 0) {
        setColumns(Object.keys(data[0]));
        setPreview(data.slice(0, 5));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = () => {
    if (!fileRef.current?.files?.[0]) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      if (type === "empresas") {
        const empresas = data.map((row: any) => ({
          sci: String(row["SCI"] || row["sci"] || ""),
          nomeEmpresarial: String(row["NOME EMPRESARIAL"] || row["Nome Empresarial"] || row["nome"] || row["Empresa"] || ""),
          cnpj: String(row["CNPJ"] || row["cnpj"] || ""),
          ie: String(row["IE"] || row["ie"] || row["Inscrição Estadual"] || ""),
          municipio: String(row["MUNICIPIO"] || row["Município"] || row["municipio"] || ""),
          tipo: String(row["TIPO"] || row["tipo"] || "MATRIZ"),
          equipe: String(row["EQUIPE"] || row["equipe"] || row["Regime"] || ""),
        })).filter((e) => e.nomeEmpresarial || e.cnpj);

        addEmpresas(empresas);
        toast({
          title: "Importação concluída",
          description: `${empresas.length} empresas importadas com sucesso.`,
        });
      } else {
        const beneficios = data.map((row: any) => {
          const cfopOuNcm = String(row["CFOP"] || row["NCM"] || row["CFOP OU NCM"] || row["CFOP ou NCM"] || row["Código"] || "");
          const isCfop = cfopOuNcm.length <= 4;
          return {
            cfopOuNcm,
            naturezaOperacao: String(row["Natureza da Operação"] || row["DESCRIÇÃO"] || row["Descrição"] || row["natureza"] || ""),
            cst: String(row["CST"] || row["cst"] || ""),
            csosn: String(row["CSOSN"] || row["csosn"] || ""),
            cBenef: String(row["cBenef"] || row["CBENEF"] || row["Código"] || ""),
            tipo: (isCfop ? "CFOP" : "NCM") as "CFOP" | "NCM",
            destinatario: String(row["Destinatário"] || row["destinatario"] || "") as any,
          };
        }).filter((b) => b.cfopOuNcm && b.cBenef);

        addBeneficios(beneficios);
        toast({
          title: "Importação concluída",
          description: `${beneficios.length} benefícios importados com sucesso.`,
        });
      }

      setOpen(false);
      setPreview([]);
      setColumns([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsBinaryString(fileRef.current.files[0]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPreview([]); setColumns([]); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar {type === "empresas" ? "Empresas" : "Benefícios"} via Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              {type === "empresas"
                ? "Colunas esperadas: SCI, NOME EMPRESARIAL, CNPJ, IE, MUNICIPIO, TIPO, EQUIPE"
                : "Colunas esperadas: CFOP OU NCM, Natureza da Operação, CST, cBenef"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
              id="excel-import"
            />
            <label htmlFor="excel-import">
              <Button variant="outline" asChild>
                <span>{fileName || "Selecionar arquivo"}</span>
              </Button>
            </label>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Pré-visualização ({preview.length} de muitas linhas)
              </p>
              <div className="overflow-x-auto rounded border">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-muted">
                      {columns.slice(0, 6).map((col) => (
                        <th key={col} className="px-2 py-1 text-left font-medium">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {columns.slice(0, 6).map((col) => (
                          <td key={col} className="px-2 py-1 truncate max-w-[150px]">{String(row[col] || "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Importar Dados
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportExcel;
