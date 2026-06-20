import { useState, useMemo, useCallback } from "react";
import { useCbenefStore } from "@/store/cbenefStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, BookOpen, Loader2, FileSpreadsheet, Pencil, GripVertical, Send, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImportExcel from "@/components/beneficio/ImportExcel";
import { tabelaCbenefSP } from "@/data/tabelaCbenef";
import { tabelaCFOP } from "@/data/tabelaCFOP";
import { tabelaCST } from "@/data/tabelaCST";
import { tabelaCSOSN } from "@/data/tabelaCSOSN";
import { searchNcm, type NcmData } from "@/utils/brasilApi";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef, isCSOSN } from "@/utils/descricaoUtils";
import { exportBeneficiosExcel } from "@/utils/exportBeneficiosExcel";
import { toast } from "sonner";

import type { Destinatario } from "@/types/cbenef";

const DESTINATARIOS: Destinatario[] = ['Contribuintes', 'Não Contribuintes', 'Órgãos Públicos', 'Templos e Cultos Religiosos'];
const EMPTY_FORM = { cfopOuNcm: "", naturezaOperacao: "", cst: "", csosn: "", cBenef: "", tipo: "CFOP" as "CFOP" | "NCM", destinatario: "" as Destinatario };

interface SelectedCfopItem {
  codigo: string;
  descricao: string;
}

const BeneficiosTab = () => {
  const { beneficios, empresas, addBeneficio, addBeneficios, updateBeneficio, removeBeneficio, assignBeneficio, empresaBeneficios } = useCbenefStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [refTab, setRefTab] = useState<"cbenef" | "cfop" | "cst" | "csosn">("cbenef");
  const [selectedCsosnDesc, setSelectedCsosnDesc] = useState("");
  const [refSearch, setRefSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [filterDestinatario, setFilterDestinatario] = useState<string>("ALL");
  const [form, setForm] = useState(EMPTY_FORM);
  const [cfopSearch, setCfopSearch] = useState("");
  const [cbenefSearch, setCbenefSearch] = useState("");
  const [showCfopList, setShowCfopList] = useState(false);
  const [showCbenefList, setShowCbenefList] = useState(false);
  const [ncmResults, setNcmResults] = useState<NcmData[]>([]);
  const [ncmSearch, setNcmSearch] = useState("");
  const [showNcmList, setShowNcmList] = useState(false);
  const [ncmLoading, setNcmLoading] = useState(false);
  const [selectedCbenefDesc, setSelectedCbenefDesc] = useState("");
  const [selectedCfopDesc, setSelectedCfopDesc] = useState("");
  const [selectedCstDesc, setSelectedCstDesc] = useState("");
  const [availableCsts, setAvailableCsts] = useState<string[]>([]);

  // Multi-select CFOP/NCM
  const [selectedCfops, setSelectedCfops] = useState<SelectedCfopItem[]>([]);
  const [selectedNcms, setSelectedNcms] = useState<SelectedCfopItem[]>([]);
  const [allCfopsSelected, setAllCfopsSelected] = useState(false);
  const [allNcmsSelected, setAllNcmsSelected] = useState(false);

  const [selectedBeneficios, setSelectedBeneficios] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [assignEmpresaOpen, setAssignEmpresaOpen] = useState(false);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [empresaSearch, setEmpresaSearch] = useState("");

  const toggleBeneficio = (id: string) => {
    setSelectedBeneficios((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAllBeneficios = () => {
    if (selectedBeneficios.length === filtered.length) {
      setSelectedBeneficios([]);
    } else {
      setSelectedBeneficios(filtered.map((b) => b.id));
    }
  };

  const handleAssignToEmpresas = () => {
    let count = 0;
    selectedEmpresas.forEach((empresaId) => {
      selectedBeneficios.forEach((beneficioId) => {
        const current = empresaBeneficios[empresaId] || [];
        if (!current.includes(beneficioId)) {
          assignBeneficio(empresaId, beneficioId);
          count++;
        }
      });
    });
    toast.success(`${count} vínculo(s) criado(s) com sucesso!`);
    setSelectedBeneficios([]);
    setSelectedEmpresas([]);
    setAssignEmpresaOpen(false);
    setEmpresaSearch("");
  };

  const filteredEmpresas = useMemo(() => {
    if (!empresaSearch) return empresas;
    const q = empresaSearch.toLowerCase();
    return empresas.filter((e) => e.nomeEmpresarial.toLowerCase().includes(q) || e.cnpj.includes(q));
  }, [empresas, empresaSearch]);

  // Resizable columns
  const [colWidths, setColWidths] = useState({
    tipo: 80,
    cfopNcm: 120,
    natureza: 180,
    cst: 60,
    descCst: 130,
    csosn: 70,
    descCsosn: 130,
    cbenef: 100,
    descCbenef: 170,
    legislacao: 170,
    destinatario: 140,
    acoes: 100,
  });

  const handleResize = useCallback((col: keyof typeof colWidths, startX: number) => {
    const startWidth = colWidths[col];
    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      setColWidths((prev) => ({ ...prev, [col]: Math.max(50, startWidth + diff) }));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths]);

  const handleNcmSearch = useCallback(async (query: string) => {
    setNcmSearch(query);
    setForm((prev) => ({ ...prev, cfopOuNcm: query }));
    if (query.length < 2) { setNcmResults([]); return; }
    setNcmLoading(true);
    try {
      const results = await searchNcm(query);
      setNcmResults(results.slice(0, 20));
      setShowNcmList(true);
    } catch {
      setNcmResults([]);
    } finally {
      setNcmLoading(false);
    }
  }, []);

  const handleBenefSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const BenefSortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const sorted = useMemo(() => {
    const cfop = beneficios.filter((b) => b.tipo === "CFOP").sort((a, b) => a.cfopOuNcm.localeCompare(b.cfopOuNcm));
    const ncm = beneficios.filter((b) => b.tipo === "NCM").sort((a, b) => a.cfopOuNcm.localeCompare(b.cfopOuNcm));
    return [...cfop, ...ncm];
  }, [beneficios]);

  const filtered = useMemo(() => {
    let list = sorted.filter((b) => {
      const matchSearch = b.cfopOuNcm.includes(search) || b.cBenef.toLowerCase().includes(search.toLowerCase()) || b.naturezaOperacao.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === "ALL" || b.tipo === filterTipo;
      const matchDest = filterDestinatario === "ALL" || b.destinatario === filterDestinatario;
      return matchSearch && matchTipo && matchDest;
    });
    if (sortCol) {
      const getSortValue = (b: typeof beneficios[0]) => {
         switch (sortCol) {
           case "tipo": return b.tipo;
           case "cfopNcm": return b.cfopOuNcm;
           case "natureza": return b.naturezaOperacao;
           case "cst": return b.cst;
           case "descCst": return b.cst ? getDescricaoCST(b.cst) : "";
           case "csosn": return b.csosn || "";
           case "descCsosn": return b.csosn ? getDescricaoCST(b.csosn) : "";
           case "cbenef": return b.cBenef;
           case "descCbenef": return getDescricaoCbenef(b.cBenef);
           case "legislacao": return getDispositivoCbenef(b.cBenef);
           case "destinatario": return b.destinatario || "";
           default: return "";
         }
      };
      list = [...list].sort((a, b) => {
        const va = getSortValue(a).toLowerCase();
        const vb = getSortValue(b).toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return list;
  }, [sorted, search, filterTipo, filterDestinatario, sortCol, sortDir]);

  const filteredCfop = useMemo(() => {
    if (!cfopSearch) return tabelaCFOP.slice(0, 20);
    return tabelaCFOP.filter(
      (c) => c.codigo.includes(cfopSearch) || c.descricao.toLowerCase().includes(cfopSearch.toLowerCase())
    ).slice(0, 20);
  }, [cfopSearch]);

  const filteredCbenef = useMemo(() => {
    if (!cbenefSearch) return tabelaCbenefSP.slice(0, 20);
    return tabelaCbenefSP.filter(
      (c) => c.codigo.toLowerCase().includes(cbenefSearch.toLowerCase()) || c.descricao.toLowerCase().includes(cbenefSearch.toLowerCase())
    ).slice(0, 20);
  }, [cbenefSearch]);

  const filteredRef = useMemo(() => {
    const s = refSearch.toLowerCase();
    if (refTab === "cbenef") {
      return tabelaCbenefSP.filter((c) => !s || c.codigo.toLowerCase().includes(s) || c.descricao.toLowerCase().includes(s));
    }
    if (refTab === "cfop") {
      return tabelaCFOP.filter((c) => !s || c.codigo.includes(s) || c.descricao.toLowerCase().includes(s));
    }
    if (refTab === "csosn") {
      return tabelaCSOSN.filter((c) => !s || c.codigo.includes(s) || c.descricao.toLowerCase().includes(s));
    }
    return tabelaCST.filter((c) => !s || c.codigo.includes(s) || c.descricao.toLowerCase().includes(s));
  }, [refTab, refSearch]);

  const handleAdd = () => {
    if (!form.cst && !form.csosn) {
      toast.error("Preencha o CST (regime Normal/LP/LR) ou o CSOSN (Simples Nacional).");
      return;
    }
    if (editingId) {
      if (!form.cfopOuNcm || !form.cBenef) return;
      updateBeneficio(editingId, form);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSelectedCbenefDesc("");
      setSelectedCfopDesc("");
      setSelectedCstDesc("");
      setSelectedCsosnDesc("");
      setAvailableCsts([]);
      setOpen(false);
      return;
    }

    // Multi-add mode
    if (!form.cBenef) return;
    let items: SelectedCfopItem[];
    if (form.tipo === "CFOP") {
      items = allCfopsSelected ? tabelaCFOP.map((c) => ({ codigo: c.codigo, descricao: c.descricao })) : selectedCfops;
    } else {
      if (allNcmsSelected) {
        addBeneficio({ cfopOuNcm: "TODOS", naturezaOperacao: "Todas as demais operações", cst: form.cst, csosn: form.csosn, cBenef: form.cBenef, tipo: form.tipo, destinatario: form.destinatario });
        toast.success("Benefício para todos os NCMs adicionado!");
        setForm(EMPTY_FORM); setSelectedCbenefDesc(""); setSelectedCfopDesc(""); setSelectedCstDesc(""); setSelectedCsosnDesc(""); setAvailableCsts([]); setSelectedCfops([]); setSelectedNcms([]); setAllCfopsSelected(false); setAllNcmsSelected(false); setOpen(false);
        return;
      }
      items = selectedNcms;
    }

    if (items.length === 0 && !form.cfopOuNcm) return;

    if (items.length > 0) {
      const newBeneficios = items.map((item) => ({
        cfopOuNcm: item.codigo,
        naturezaOperacao: item.descricao,
        cst: form.cst,
        csosn: form.csosn,
        cBenef: form.cBenef,
        tipo: form.tipo,
        destinatario: form.destinatario,
      }));
      addBeneficios(newBeneficios);
      toast.success(`${newBeneficios.length} benefício(s) adicionado(s) com sucesso!`);
    } else {
      addBeneficio(form);
    }
    setForm(EMPTY_FORM);
    setSelectedCbenefDesc("");
    setSelectedCfopDesc("");
    setSelectedCstDesc("");
    setSelectedCsosnDesc("");
    setAvailableCsts([]);
    setSelectedCfops([]);
    setSelectedNcms([]);
    setAllCfopsSelected(false);
    setAllNcmsSelected(false);
    setOpen(false);
  };

  const handleEdit = (b: typeof beneficios[0]) => {
    setEditingId(b.id);
    setForm({ cfopOuNcm: b.cfopOuNcm, naturezaOperacao: b.naturezaOperacao, cst: b.cst, csosn: b.csosn || "", cBenef: b.cBenef, tipo: b.tipo, destinatario: b.destinatario || "" as Destinatario });
    setSelectedCbenefDesc(getDescricaoCbenef(b.cBenef));
    setSelectedCstDesc(b.cst ? getDescricaoCST(b.cst) : "");
    setSelectedCsosnDesc(b.csosn ? getDescricaoCST(b.csosn) : "");
    // Find CFOP description
    if (b.tipo === "CFOP") {
      const cfop = tabelaCFOP.find((c) => c.codigo === b.cfopOuNcm);
      setSelectedCfopDesc(cfop?.descricao || "");
    } else {
      setSelectedCfopDesc(b.naturezaOperacao);
    }
    // Load available CSTs from cBenef
    const cbenef = tabelaCbenefSP.find((c) => c.codigo === b.cBenef);
    setAvailableCsts(cbenef?.cstAplicaveis || []);
    setOpen(true);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSelectedCbenefDesc("");
      setSelectedCfopDesc("");
      setSelectedCstDesc("");
      setSelectedCsosnDesc("");
      setAvailableCsts([]);
      setSelectedCfops([]);
      setSelectedNcms([]);
      setAllCfopsSelected(false);
      setAllNcmsSelected(false);
    }
  };

  const selectCfop = (codigo: string, descricao: string) => {
    setForm({ ...form, cfopOuNcm: codigo, naturezaOperacao: descricao });
    setSelectedCfopDesc(descricao);
    setCfopSearch("");
    setShowCfopList(false);
  };

  const selectCbenef = (codigo: string, descricao: string, cstList: string[]) => {
    setAvailableCsts(cstList);
    const newCst = cstList.length === 1 ? cstList[0] : (cstList.includes(form.cst) ? form.cst : "");
    const cstDesc = newCst ? getDescricaoCST(newCst) : "";
    setForm({ ...form, cBenef: codigo, cst: newCst });
    setSelectedCbenefDesc(descricao);
    setSelectedCstDesc(cstDesc);
    setCbenefSearch("");
    setShowCbenefList(false);
  };

  const ResizeHandle = ({ col }: { col: keyof typeof colWidths }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 flex items-center justify-center"
      onMouseDown={(e) => { e.preventDefault(); handleResize(col, e.clientX); }}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar CFOP, NCM ou cBenef..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="CFOP">CFOP</SelectItem>
            <SelectItem value="NCM">NCM</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDestinatario} onValueChange={setFilterDestinatario}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Destinatário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos Destinatários</SelectItem>
            {DESTINATARIOS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedBeneficios.length > 0 && (
            <Dialog open={assignEmpresaOpen} onOpenChange={(open) => { setAssignEmpresaOpen(open); if (!open) { setSelectedEmpresas([]); setEmpresaSearch(""); } }}>
              <DialogTrigger asChild>
                <Button variant="default">
                  <Send className="h-4 w-4 mr-2" />
                  Vincular {selectedBeneficios.length} selecionado(s) a empresas
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Vincular Benefícios às Empresas</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mb-2">
                  Selecione as empresas que receberão os {selectedBeneficios.length} benefício(s) marcado(s):
                </p>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Pesquisar empresa..." value={empresaSearch} onChange={(e) => setEmpresaSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="space-y-2">
                  {filteredEmpresas.map((e) => {
                    const isSelected = selectedEmpresas.includes(e.id);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
                        onClick={() => setSelectedEmpresas((prev) => isSelected ? prev.filter((x) => x !== e.id) : [...prev, e.id])}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.nomeEmpresarial}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.cnpj}</p>
                        </div>
                      </div>
                    );
                  })}
                  {filteredEmpresas.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhuma empresa encontrada</p>
                  )}
                </div>
                <Button onClick={handleAssignToEmpresas} disabled={selectedEmpresas.length === 0} className="w-full mt-3">
                  Vincular a {selectedEmpresas.length} empresa(s)
                </Button>
              </DialogContent>
            </Dialog>
          )}


          <Dialog open={refOpen} onOpenChange={setRefOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><BookOpen className="h-4 w-4 mr-2" />Consultar Tabelas</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Tabelas de Referência</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 mb-3 flex-wrap">
                {[
                  { id: "cbenef" as const, label: "Tabela cBenef SP" },
                  { id: "cfop" as const, label: "CFOP" },
                  { id: "cst" as const, label: "CST ICMS" },
                  { id: "csosn" as const, label: "CSOSN" },
                ].map((t) => (
                  <Button
                    key={t.id}
                    variant={refTab === t.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setRefTab(t.id); setRefSearch(""); }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={refSearch} onChange={(e) => setRefSearch(e.target.value)} className="pl-10" />
              </div>
              <ScrollArea className="h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      {refTab === "cbenef" && (
                        <>
                          <TableHead className="text-secondary-foreground font-semibold">Código</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">Descrição</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">Dispositivo</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">CSTs</TableHead>
                        </>
                      )}
                      {refTab === "cfop" && (
                        <>
                          <TableHead className="text-secondary-foreground font-semibold">CFOP</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">Descrição</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">Grupo</TableHead>
                        </>
                      )}
                      {(refTab === "cst" || refTab === "csosn") && (
                        <>
                          <TableHead className="text-secondary-foreground font-semibold">{refTab === "csosn" ? "CSOSN" : "CST"}</TableHead>
                          <TableHead className="text-secondary-foreground font-semibold">Descrição</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredRef as any[]).map((item: any, i: number) => (
                      <TableRow key={i} className="hover:bg-accent/50">
                        {refTab === "cbenef" && (
                          <>
                            <TableCell className="font-mono font-medium">{item.codigo}</TableCell>
                            <TableCell className="text-sm">{item.descricao}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.dispositivo}</TableCell>
                            <TableCell className="font-mono text-xs">{item.cstAplicaveis?.join(", ")}</TableCell>
                          </>
                        )}
                        {refTab === "cfop" && (
                          <>
                            <TableCell className="font-mono font-medium">{item.codigo}</TableCell>
                            <TableCell className="text-sm">{item.descricao}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.grupo}</TableCell>
                          </>
                        )}
                        {(refTab === "cst" || refTab === "csosn") && (
                          <>
                            <TableCell className="font-mono font-medium">{item.codigo}</TableCell>
                            <TableCell className="text-sm">{item.descricao}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <ImportExcel type="beneficios" />

          <Button variant="outline" onClick={() => { import("@/utils/exportTemplateExcel").then((m) => m.exportTemplateBeneficios()); }}>
            <Download className="h-4 w-4 mr-2" />Baixar Modelo
          </Button>

          <Button variant="outline" onClick={() => exportBeneficiosExcel(beneficios)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel
          </Button>

          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Benefício</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Benefício Fiscal" : "Adicionar Benefício Fiscal"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid gap-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as "CFOP" | "NCM" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CFOP">CFOP</SelectItem>
                      <SelectItem value="NCM">NCM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* CFOP / NCM with multi-select */}
                <div className="grid gap-1.5">
                  <Label>{form.tipo === "CFOP" ? "CFOP(s)" : "NCM(s)"}</Label>
                  {editingId ? (
                    /* Single select mode for editing */
                    form.tipo === "CFOP" ? (
                      <div className="relative">
                        <Input
                          value={form.cfopOuNcm}
                          onChange={(e) => {
                            setForm({ ...form, cfopOuNcm: e.target.value });
                            setCfopSearch(e.target.value);
                            setShowCfopList(true);
                            setSelectedCfopDesc("");
                          }}
                          onFocus={() => { setCfopSearch(form.cfopOuNcm); setShowCfopList(true); }}
                          onBlur={() => setTimeout(() => setShowCfopList(false), 200)}
                          placeholder="Digite o CFOP..."
                        />
                        {showCfopList && filteredCfop.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                            {filteredCfop.map((c) => (
                              <button
                                key={c.codigo}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2"
                                onMouseDown={(e) => { e.preventDefault(); selectCfop(c.codigo, c.descricao); }}
                              >
                                <span className="font-mono font-medium shrink-0">{c.codigo}</span>
                                <span className="truncate text-muted-foreground">{c.descricao}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedCfopDesc && (
                          <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">{selectedCfopDesc}</p>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          value={form.cfopOuNcm}
                          onChange={(e) => handleNcmSearch(e.target.value)}
                          onFocus={() => ncmResults.length > 0 && setShowNcmList(true)}
                          onBlur={() => setTimeout(() => setShowNcmList(false), 200)}
                          placeholder="Digite código ou descrição do NCM..."
                        />
                        {ncmLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                        {showNcmList && ncmResults.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                            {ncmResults.map((n) => (
                              <button key={n.codigo} className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2"
                                onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, cfopOuNcm: n.codigo, naturezaOperacao: n.descricao }); setSelectedCfopDesc(n.descricao); setShowNcmList(false); }}>
                                <span className="font-mono font-medium shrink-0">{n.codigo}</span>
                                <span className="truncate text-muted-foreground">{n.descricao}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedCfopDesc && <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">{selectedCfopDesc}</p>}
                      </div>
                    )
                  ) : (
                    /* Multi-select mode for new benefit */
                    form.tipo === "CFOP" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allCfopsSelected}
                            onCheckedChange={(checked) => {
                              setAllCfopsSelected(!!checked);
                              if (checked) setSelectedCfops([]);
                            }}
                          />
                          <span className="text-sm font-medium">Todos os CFOPs</span>
                        </div>
                        {!allCfopsSelected && (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                value={cfopSearch}
                                onChange={(e) => { setCfopSearch(e.target.value); setShowCfopList(true); }}
                                onFocus={() => setShowCfopList(true)}
                                onBlur={() => setTimeout(() => setShowCfopList(false), 200)}
                                placeholder="Pesquisar CFOP..."
                                className="pl-9"
                              />
                              {showCfopList && filteredCfop.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                  {filteredCfop.map((c) => {
                                    const isSelected = selectedCfops.some((s) => s.codigo === c.codigo);
                                    return (
                                      <button
                                        key={c.codigo}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2 items-center ${isSelected ? "bg-accent/50" : ""}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (isSelected) {
                                            setSelectedCfops((prev) => prev.filter((s) => s.codigo !== c.codigo));
                                          } else {
                                            setSelectedCfops((prev) => [...prev, { codigo: c.codigo, descricao: c.descricao }]);
                                          }
                                        }}
                                      >
                                        <Checkbox checked={isSelected} className="pointer-events-none" />
                                        <span className="font-mono font-medium shrink-0">{c.codigo}</span>
                                        <span className="truncate text-muted-foreground">{c.descricao}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {selectedCfops.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {selectedCfops.map((c) => (
                                  <Badge key={c.codigo} variant="secondary" className="text-xs cursor-pointer" onClick={() => setSelectedCfops((prev) => prev.filter((s) => s.codigo !== c.codigo))}>
                                    {c.codigo} ✕
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {allCfopsSelected && (
                          <p className="text-xs text-primary bg-primary/10 rounded px-2 py-1">
                            Todos os {tabelaCFOP.length} CFOPs serão incluídos
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allNcmsSelected}
                            onCheckedChange={(checked) => {
                              setAllNcmsSelected(!!checked);
                              if (checked) setSelectedNcms([]);
                            }}
                          />
                          <span className="text-sm font-medium">Todos os NCMs</span>
                        </div>
                        {!allNcmsSelected && (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                value={ncmSearch}
                                onChange={(e) => handleNcmSearch(e.target.value)}
                                onFocus={() => ncmResults.length > 0 && setShowNcmList(true)}
                                onBlur={() => setTimeout(() => setShowNcmList(false), 200)}
                                placeholder="Pesquisar NCM..."
                                className="pl-9"
                              />
                              {ncmLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                              {showNcmList && ncmResults.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                  {ncmResults.map((n) => {
                                    const isSelected = selectedNcms.some((s) => s.codigo === n.codigo);
                                    return (
                                      <button
                                        key={n.codigo}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2 items-center ${isSelected ? "bg-accent/50" : ""}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (isSelected) {
                                            setSelectedNcms((prev) => prev.filter((s) => s.codigo !== n.codigo));
                                          } else {
                                            setSelectedNcms((prev) => [...prev, { codigo: n.codigo, descricao: n.descricao }]);
                                          }
                                        }}
                                      >
                                        <Checkbox checked={isSelected} className="pointer-events-none" />
                                        <span className="font-mono font-medium shrink-0">{n.codigo}</span>
                                        <span className="truncate text-muted-foreground">{n.descricao}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {selectedNcms.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {selectedNcms.map((n) => (
                                  <Badge key={n.codigo} variant="secondary" className="text-xs cursor-pointer" onClick={() => setSelectedNcms((prev) => prev.filter((s) => s.codigo !== n.codigo))}>
                                    {n.codigo} ✕
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {allNcmsSelected && (
                          <p className="text-xs text-primary bg-primary/10 rounded px-2 py-1">
                            Um benefício será criado com NCM "TODOS"
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>


                {/* cBenef with autocomplete */}
                <div className="grid gap-1.5 relative">
                  <Label>cBenef</Label>
                  <div className="relative">
                    <Input
                      value={form.cBenef}
                      onChange={(e) => {
                        setForm({ ...form, cBenef: e.target.value });
                        setCbenefSearch(e.target.value);
                        setShowCbenefList(true);
                        setSelectedCbenefDesc("");
                        setAvailableCsts([]);
                      }}
                      onFocus={() => { setCbenefSearch(form.cBenef); setShowCbenefList(true); }}
                      onBlur={() => setTimeout(() => setShowCbenefList(false), 200)}
                      placeholder="Digite o código cBenef..."
                    />
                    {showCbenefList && filteredCbenef.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                        {filteredCbenef.map((c) => (
                          <button
                            key={c.codigo}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex gap-2"
                            onMouseDown={(e) => { e.preventDefault(); selectCbenef(c.codigo, c.descricao, c.cstAplicaveis); }}
                          >
                            <span className="font-mono font-medium shrink-0">{c.codigo}</span>
                            <span className="truncate text-muted-foreground">{c.descricao}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedCbenefDesc && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                      {selectedCbenefDesc}
                    </p>
                  )}
                </div>

                {/* CST (Lucro Presumido / Real) */}
                <div className="grid gap-1.5">
                  <Label>
                    CST (Lucro Presumido / Real)
                    {availableCsts.length > 1 && (
                      <span className="ml-2 text-xs text-primary font-normal">
                        ({availableCsts.length} CSTs disponíveis para este cBenef)
                      </span>
                    )}
                  </Label>
                  <Select
                    value={form.cst}
                    onValueChange={(v) => {
                      setForm({ ...form, cst: v });
                      setSelectedCstDesc(getDescricaoCST(v));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o CST..." /></SelectTrigger>
                    <SelectContent>
                      {(availableCsts.length > 0
                        ? tabelaCST.filter((c) => availableCsts.includes(c.codigo))
                        : tabelaCST
                      ).map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          {c.codigo} - {c.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCstDesc && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                      {selectedCstDesc}
                    </p>
                  )}
                </div>

                {/* CSOSN (Simples Nacional) */}
                <div className="grid gap-1.5">
                  <Label>CSOSN (Simples Nacional)</Label>
                  <Select
                    value={form.csosn}
                    onValueChange={(v) => {
                      setForm({ ...form, csosn: v });
                      setSelectedCsosnDesc(getDescricaoCST(v));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o CSOSN..." /></SelectTrigger>
                    <SelectContent>
                      {tabelaCSOSN.map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          {c.codigo} - {c.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCsosnDesc && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                      {selectedCsosnDesc}
                    </p>
                  )}
                </div>

                {/* Destinatário */}
                <div className="grid gap-1.5">
                  <Label>Destinatário</Label>
                  <Select value={form.destinatario} onValueChange={(v) => setForm({ ...form, destinatario: v as Destinatario })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o destinatário..." /></SelectTrigger>
                    <SelectContent>
                      {DESTINATARIOS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">
                {editingId ? "Salvar Alterações" : (
                  form.tipo === "CFOP"
                    ? (allCfopsSelected ? `Adicionar para todos os ${tabelaCFOP.length} CFOPs` : selectedCfops.length > 1 ? `Adicionar ${selectedCfops.length} benefícios` : "Adicionar")
                    : (allNcmsSelected ? "Adicionar para todos os NCMs" : selectedNcms.length > 1 ? `Adicionar ${selectedNcms.length} benefícios` : "Adicionar")
                )}
              </Button>
            </DialogContent>
          </Dialog>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table style={{ tableLayout: "fixed", width: 40 + Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-secondary-foreground w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedBeneficios.length === filtered.length}
                  onCheckedChange={toggleAllBeneficios}
                />
              </TableHead>
              {[
                { key: "tipo" as const, label: "Tipo" },
                { key: "cfopNcm" as const, label: "CFOP / NCM" },
                { key: "natureza" as const, label: "Natureza da Operação" },
                { key: "cst" as const, label: "CST" },
                { key: "descCst" as const, label: "Desc. CST" },
                { key: "csosn" as const, label: "CSOSN" },
                { key: "descCsosn" as const, label: "Desc. CSOSN" },
                { key: "cbenef" as const, label: "cBenef" },
                { key: "descCbenef" as const, label: "Descrição cBenef" },
                { key: "legislacao" as const, label: "Legislação" },
                { key: "destinatario" as const, label: "Destinatário" },
                { key: "acoes" as const, label: "" },
              ].map((col) => (
                <TableHead
                  key={col.key}
                  className="text-secondary-foreground font-semibold relative select-none"
                  style={{ width: colWidths[col.key], minWidth: 50 }}
                >
                  {col.key !== "acoes" ? (
                    <span className="cursor-pointer select-none inline-flex items-center" onClick={() => handleBenefSort(col.key)}>
                      {col.label}<BenefSortIcon col={col.key} />
                    </span>
                  ) : col.label}
                  {col.key !== "acoes" && <ResizeHandle col={col.key} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id} className={`hover:bg-accent/50 ${selectedBeneficios.includes(b.id) ? "bg-accent/30" : ""}`}>
                <TableCell className="w-10">
                  <Checkbox checked={selectedBeneficios.includes(b.id)} onCheckedChange={() => toggleBeneficio(b.id)} />
                </TableCell>
                <TableCell style={{ width: colWidths.tipo }}>
                  <Badge variant={b.tipo === "CFOP" ? "default" : "secondary"}>
                    {b.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono font-medium truncate" style={{ width: colWidths.cfopNcm }}>{b.cfopOuNcm}</TableCell>
                <TableCell className="truncate" style={{ width: colWidths.natureza }}>{b.naturezaOperacao}</TableCell>
                <TableCell className="font-mono" style={{ width: colWidths.cst }}>{b.cst || "—"}</TableCell>
                <TableCell className="text-xs truncate" style={{ width: colWidths.descCst }}>{b.cst ? getDescricaoCST(b.cst) : "—"}</TableCell>
                <TableCell className="font-mono" style={{ width: colWidths.csosn }}>{b.csosn || "—"}</TableCell>
                <TableCell className="text-xs truncate" style={{ width: colWidths.descCsosn }}>{b.csosn ? getDescricaoCST(b.csosn) : "—"}</TableCell>
                <TableCell className="font-mono font-semibold truncate" style={{ width: colWidths.cbenef }}>{b.cBenef}</TableCell>
                <TableCell className="text-xs truncate" style={{ width: colWidths.descCbenef }}>{getDescricaoCbenef(b.cBenef)}</TableCell>
                <TableCell className="text-xs truncate" style={{ width: colWidths.legislacao }}>{getDispositivoCbenef(b.cBenef)}</TableCell>
                <TableCell className="text-xs truncate" style={{ width: colWidths.destinatario }}>{b.destinatario || "—"}</TableCell>
                <TableCell style={{ width: colWidths.acoes }}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(b)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeBeneficio(b.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Nenhum benefício encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BeneficiosTab;
