import { useState, useMemo, useCallback, useRef } from "react";
import { useCbenefStore } from "@/store/cbenefStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, FileSpreadsheet, Plus, X, Search, Download, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { generatePDF } from "@/utils/exportPdf";
import { generateExcel } from "@/utils/exportExcel";
import { generateAllEmpresasPDF, generateAllEmpresasExcel } from "@/utils/exportAllEmpresas";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef, validarCompatibilidadeCstEmpresa, getCodigoParaEmpresa, isEmpresaSimplesNacional } from "@/utils/descricaoUtils";
import { toast } from "sonner";

const RelatoriosTab = () => {
  const { empresas, beneficios, empresaBeneficios, assignBeneficio, unassignBeneficio, getEmpresaBeneficios } = useCbenefStore();
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [searchVinculo, setSearchVinculo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const empresa = empresas.find((e) => e.id === selectedEmpresa);
  const assignedBeneficios = selectedEmpresa ? getEmpresaBeneficios(selectedEmpresa) : [];
  const assignedIds = empresaBeneficios[selectedEmpresa] || [];

  // Validation: check for incompatible CST/CSOSN
  const errosValidacao = useMemo(() => {
    if (!empresa) return [];
    return assignedBeneficios
      .map((b) => {
        const resultado = validarCompatibilidadeCstEmpresa(b.cst, b.csosn || "", empresa.equipe);
        if (!resultado.valido) {
          return { beneficioId: b.id, cfopOuNcm: b.cfopOuNcm, cst: b.cst, mensagem: resultado.mensagem };
        }
        return null;
      })
      .filter(Boolean) as { beneficioId: string; cfopOuNcm: string; cst: string; mensagem: string }[];
  }, [empresa, assignedBeneficios]);

  const temErros = errosValidacao.length > 0;

  // Sorting
  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const isSimplesNacional = empresa ? isEmpresaSimplesNacional(empresa.equipe) : false;

  const sortedBeneficios = useMemo(() => {
    if (!sortCol) return assignedBeneficios;
    const getSortValue = (b: typeof assignedBeneficios[0]) => {
      switch (sortCol) {
        case "tipo": return b.tipo;
        case "cfopNcm": return b.cfopOuNcm;
        case "natureza": return b.naturezaOperacao;
        case "cstCsosn": return isSimplesNacional ? (b.csosn || "") : b.cst;
        case "descCstCsosn": return getDescricaoCST(isSimplesNacional ? (b.csosn || "") : b.cst);
        case "cbenef": return b.cBenef;
        case "descCbenef": return getDescricaoCbenef(b.cBenef);
        case "legislacao": return getDispositivoCbenef(b.cBenef);
        case "destinatario": return b.destinatario || "";
        default: return "";
      }
    };
    return [...assignedBeneficios].sort((a, b) => {
      const va = getSortValue(a).toLowerCase();
      const vb = getSortValue(b).toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [assignedBeneficios, sortCol, sortDir, isSimplesNacional]);

  // Resizable columns
  const [colWidths, setColWidths] = useState([70, 100, 180, 60, 140, 90, 160, 160, 120, 50]);
  const resizingCol = useRef<number | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizingCol.current = colIndex;
    startX.current = e.clientX;
    startWidth.current = colWidths[colIndex];

    const handleMouseMove = (ev: MouseEvent) => {
      if (resizingCol.current === null) return;
      const diff = ev.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingCol.current!] = newWidth;
        return next;
      });
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleAssignBeneficio = (beneficioId: string) => {
    if (!empresa) return;
    const beneficio = beneficios.find((b) => b.id === beneficioId);
    if (!beneficio) return;

    const resultado = validarCompatibilidadeCstEmpresa(beneficio.cst, beneficio.csosn || "", empresa.equipe);
    if (!resultado.valido) {
      toast.error(resultado.mensagem);
      return;
    }
    assignBeneficio(selectedEmpresa, beneficioId);
  };

  const handleExportPDF = () => {
    if (!empresa || temErros) return;
    generatePDF(empresa, assignedBeneficios, observacoes);
  };

  const handleExportExcel = () => {
    if (!empresa || temErros) return;
    generateExcel(empresa, assignedBeneficios, observacoes);
  };

  const handleExportAllPDF = () => {
    const items = empresas
      .map((e) => ({ empresa: e, beneficios: getEmpresaBeneficios(e.id) }))
      .filter((item) => item.beneficios.length > 0);
    if (items.length === 0) return;
    // Check for any validation errors across all companies
    const hasErrors = items.some((item) =>
      item.beneficios.some((b) => !validarCompatibilidadeCstEmpresa(b.cst, b.csosn || "", item.empresa.equipe).valido)
    );
    if (hasErrors) {
      toast.error("Existem erros de compatibilidade CST/CSOSN em uma ou mais empresas. Corrija antes de exportar.");
      return;
    }
    generateAllEmpresasPDF(items);
  };

  const handleExportAllExcel = () => {
    const items = empresas
      .map((e) => ({ empresa: e, beneficios: getEmpresaBeneficios(e.id) }))
      .filter((item) => item.beneficios.length > 0);
    if (items.length === 0) return;
    const hasErrors = items.some((item) =>
      item.beneficios.some((b) => !validarCompatibilidadeCstEmpresa(b.cst, b.csosn || "", item.empresa.equipe).valido)
    );
    if (hasErrors) {
      toast.error("Existem erros de compatibilidade CST/CSOSN em uma ou mais empresas. Corrija antes de exportar.");
      return;
    }
    generateAllEmpresasExcel(items);
  };

  const cstCsosnLabel = isSimplesNacional ? "CSOSN" : "CST";

  const colDefs = [
    { key: "tipo", label: "Tipo" },
    { key: "cfopNcm", label: "CFOP / NCM" },
    { key: "natureza", label: "Descrição" },
    { key: "cstCsosn", label: cstCsosnLabel },
    { key: "descCstCsosn", label: `Descrição ${cstCsosnLabel}` },
    { key: "cbenef", label: "cBenef" },
    { key: "descCbenef", label: "Descrição cBenef" },
    { key: "legislacao", label: "Legislação" },
    { key: "destinatario", label: "Destinatário" },
    { key: "acoes", label: "" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
            <SelectTrigger className="w-96">
              <SelectValue placeholder="Selecione uma empresa..." />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nomeEmpresarial} - {e.cnpj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEmpresa && (
            <Dialog open={assignOpen} onOpenChange={(open) => { setAssignOpen(open); if (!open) setSearchVinculo(""); }}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Vincular Benefício</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Vincular Benefícios - {empresa?.nomeEmpresarial}</DialogTitle>
                </DialogHeader>
                {empresa && (
                  <p className="text-xs text-muted-foreground mb-1">
                    Regime: <strong>{empresa.equipe}</strong> — Exibindo {isSimplesNacional ? "CSOSN" : "CST"} no relatório
                  </p>
                )}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por tipo, CFOP/NCM, descrição ou cBenef..."
                    value={searchVinculo}
                    onChange={(e) => setSearchVinculo(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2 py-2">
                  {beneficios.filter((b) => {
                    if (!searchVinculo) return true;
                    const q = searchVinculo.toLowerCase();
                    return (
                      b.tipo.toLowerCase().includes(q) ||
                      b.cfopOuNcm.toLowerCase().includes(q) ||
                      b.naturezaOperacao.toLowerCase().includes(q) ||
                      b.cBenef.toLowerCase().includes(q) ||
                      b.cst.toLowerCase().includes(q)
                    );
                  }).map((b) => {
                    const isAssigned = assignedIds.includes(b.id);
                    const validacao = empresa ? validarCompatibilidadeCstEmpresa(b.cst, b.csosn || "", empresa.equipe) : { valido: true, mensagem: "" };
                    const codigoExibir = isSimplesNacional ? (b.csosn || "") : b.cst;
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                          !validacao.valido ? "border-destructive/50 bg-destructive/5 opacity-60" : "hover:bg-accent/50"
                        }`}
                        onClick={() => {
                          if (isAssigned) unassignBeneficio(selectedEmpresa, b.id);
                          else handleAssignBeneficio(b.id);
                        }}
                      >
                        <Checkbox checked={isAssigned} disabled={!validacao.valido && !isAssigned} />
                        <Badge variant={b.tipo === "CFOP" ? "default" : "secondary"} className="shrink-0">{b.tipo}</Badge>
                        <span className="font-mono text-sm font-medium shrink-0">{b.cfopOuNcm}</span>
                        <span className="text-sm truncate">{b.naturezaOperacao}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {cstCsosnLabel} {codigoExibir || "—"}
                          </Badge>
                          <span className="font-mono text-sm shrink-0">{b.cBenef}</span>
                          {!validacao.valido && (
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {selectedEmpresa && assignedBeneficios.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} variant="outline" disabled={temErros}>
              <FileText className="h-4 w-4 mr-2" />Exportar PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" disabled={temErros}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel
            </Button>
          </div>
        )}
      </div>

      {empresa && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">SCI</span>
              <p className="font-mono font-medium">{empresa.sci}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">CNPJ</span>
              <p className="font-mono font-medium">{empresa.cnpj}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">IE</span>
              <p className="font-mono font-medium">{empresa.ie}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Município</span>
              <p className="font-medium">{empresa.municipio}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Regime</span>
              <p className="font-medium">{empresa.equipe}</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {temErros && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">
              Existem {errosValidacao.length} erro(s) de compatibilidade CST/CSOSN. A exportação está bloqueada até a correção.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {errosValidacao.map((e) => (
                <li key={e.beneficioId}>
                  <strong>{e.cfopOuNcm}</strong> — {e.mensagem}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {selectedEmpresa && (
        <>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  {colDefs.map((col, i) => (
                    <TableHead
                      key={col.key}
                      className="text-secondary-foreground font-semibold relative select-none"
                      style={{ width: colWidths[i], minWidth: 50 }}
                    >
                      {col.key !== "acoes" ? (
                        <span className="cursor-pointer select-none inline-flex items-center" onClick={() => handleSort(col.key)}>
                          {col.label}<SortIcon col={col.key} />
                        </span>
                      ) : col.label}
                      {i < colDefs.length - 1 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10"
                          onMouseDown={(e) => handleMouseDown(i, e)}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBeneficios.map((b) => {
                  const erro = errosValidacao.find((e) => e.beneficioId === b.id);
                  const codigoExibir = isSimplesNacional ? (b.csosn || "") : b.cst;
                  return (
                    <TableRow key={b.id} className={`hover:bg-accent/50 ${erro ? "bg-destructive/10" : ""}`}>
                      <TableCell style={{ width: colWidths[0] }}>
                        <Badge variant={b.tipo === "CFOP" ? "default" : "secondary"}>{b.tipo}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium" style={{ width: colWidths[1] }}>{b.cfopOuNcm}</TableCell>
                      <TableCell className="max-w-md truncate" style={{ width: colWidths[2] }}>{b.naturezaOperacao}</TableCell>
                      <TableCell className="font-mono" style={{ width: colWidths[3] }}>
                        <span className={erro ? "text-destructive font-bold" : ""}>
                          {codigoExibir || "—"}
                          {erro && <AlertTriangle className="h-3 w-3 inline ml-1 text-destructive" />}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs truncate" style={{ width: colWidths[4] }}>{codigoExibir ? getDescricaoCST(codigoExibir) : "—"}</TableCell>
                      <TableCell className="font-mono font-semibold" style={{ width: colWidths[5] }}>{b.cBenef}</TableCell>
                      <TableCell className="text-xs truncate" style={{ width: colWidths[6] }}>{getDescricaoCbenef(b.cBenef)}</TableCell>
                      <TableCell className="text-xs truncate" style={{ width: colWidths[7] }}>{getDispositivoCbenef(b.cBenef)}</TableCell>
                      <TableCell className="text-xs truncate" style={{ width: colWidths[8] }}>{b.destinatario || "—"}</TableCell>
                      <TableCell style={{ width: colWidths[9] }}>
                        <Button variant="ghost" size="icon" onClick={() => unassignBeneficio(selectedEmpresa, b.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {assignedBeneficios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum benefício vinculado. Clique em "Vincular Benefício" para adicionar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Observações */}
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <Label className="text-sm font-semibold">Observações do Relatório</Label>
            <Textarea
              placeholder="Adicione observações que serão incluídas no relatório exportado..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Embasamento legal: Portaria SRE 70/2025 — será incluído automaticamente no relatório.
            </p>
          </div>
        </>
      )}

      {/* Bulk export for all companies */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Exportar Todas as Empresas</h3>
            <p className="text-xs text-muted-foreground">Gera relatório consolidado de todas as empresas com benefícios vinculados.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportAllPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />PDF Consolidado
            </Button>
            <Button onClick={handleExportAllExcel} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />Excel Consolidado
            </Button>
          </div>
        </div>
      </div>

      {!selectedEmpresa && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Selecione uma empresa para gerar o relatório individual</p>
        </div>
      )}
    </div>
  );
};

export default RelatoriosTab;
