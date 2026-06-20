import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCbenefStore } from "@/store/cbenefStore";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { apiClients, type Client } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, Loader2, CheckCircle2, XCircle, Pencil, Copy, FileSpreadsheet, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImportExcel from "@/components/beneficio/ImportExcel";
import { formatCnpj, validateCnpj, cleanCnpj } from "@/utils/cnpjUtils";
import { fetchCnpjData } from "@/utils/brasilApi";
import { exportEmpresasExcel } from "@/utils/exportEmpresasExcel";
import { exportTemplateEmpresas } from "@/utils/exportTemplateExcel";
import { toast } from "sonner";
import type { Empresa } from "@/types/cbenef";

type EmpresaForm = { sci: string; nomeEmpresarial: string; cnpj: string; ie: string; municipio: string; tipo: string; equipe: string };
const emptyForm: EmpresaForm = { sci: "", nomeEmpresarial: "", cnpj: "", ie: "", municipio: "", tipo: "MATRIZ", equipe: "" };
const defaultColWidths = [40, 80, 250, 170, 130, 150, 130, 80];

const EmpresasTab = () => {
  const { empresas, beneficios, addEmpresa, updateEmpresa, removeEmpresa, removeEmpresas, duplicarBeneficios, empresaBeneficios, getEmpresaBeneficios } = useCbenefStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<EmpresaForm>({ ...emptyForm });
  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSimples, setIsSimples] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<number[]>(defaultColWidths);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  // Duplicar dialog
  const [dupOpen, setDupOpen] = useState(false);
  const [dupOrigem, setDupOrigem] = useState("");
  const [dupDestinos, setDupDestinos] = useState<string[]>([]);
  const [dupSearch, setDupSearch] = useState("");
  const [dupSelectedBeneficios, setDupSelectedBeneficios] = useState<string[]>([]);
  const [dupAllSelected, setDupAllSelected] = useState(true);

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
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingCol.current!] = Math.max(40, startWidth.current + diff);
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

  // Filtro global de clientes do header — restringe a tabela aos CNPJs
  // dos clientes selecionados. Vazio = mostra tudo (comportamento original).
  const { selectedIds: globalSelectedIds } = useSelectedClients();
  const [globalClients, setGlobalClients] = useState<Client[]>([]);
  useEffect(() => {
    if (!globalSelectedIds.length) return;
    let cancelled = false;
    apiClients.list()
      .then((d) => { if (!cancelled) setGlobalClients(d); })
      .catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  }, [globalSelectedIds.length]);
  const cnpjsGlobais = useMemo(() => {
    if (!globalSelectedIds.length) return null;
    const set = new Set<string>();
    for (const id of globalSelectedIds) {
      const c = globalClients.find((x) => x.id === id);
      const digits = (c?.cnpj || "").replace(/\D/g, "");
      if (digits) set.add(digits);
    }
    return set.size ? set : null;
  }, [globalSelectedIds, globalClients]);

  const filtered = useMemo(() => {
    let list = empresas.filter(
      (e) => e.nomeEmpresarial.toLowerCase().includes(search.toLowerCase()) || e.cnpj.includes(search)
    );
    if (cnpjsGlobais) {
      list = list.filter((e) => cnpjsGlobais.has((e.cnpj || "").replace(/\D/g, "")));
    }
    if (!sortCol) return list;
    const key = sortCol as keyof Empresa;
    return [...list].sort((a, b) => {
      const va = (a[key] || "").toString().toLowerCase();
      const vb = (b[key] || "").toString().toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [empresas, search, sortCol, sortDir, cnpjsGlobais]);

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpj(value);
    setForm({ ...form, cnpj: formatted });
    const digits = cleanCnpj(formatted);
    if (digits.length === 14) {
      const valid = validateCnpj(formatted);
      setCnpjValid(valid);
      if (valid) buscarCnpj(digits);
    } else {
      setCnpjValid(null);
      setIsSimples(null);
    }
  };

  const buscarCnpj = useCallback(async (cnpj: string) => {
    setLoading(true);
    try {
      const data = await fetchCnpjData(cnpj);
      const ieSP = data.inscricoes_estaduais?.find((ie) => ie.estado === "SP" && ie.ativo);
      const simples = data.opcao_pelo_simples === true;
      setIsSimples(simples);
      setForm((prev) => ({
        ...prev,
        nomeEmpresarial: data.razao_social || prev.nomeEmpresarial,
        municipio: data.municipio || prev.municipio,
        ie: ieSP?.inscricao_estadual || prev.ie,
        equipe: simples ? "SIMPLES NACIONAL" : prev.equipe,
      }));
      toast.success("Dados do CNPJ carregados com sucesso!");
    } catch {
      toast.error("Não foi possível buscar os dados do CNPJ.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = () => {
    if (!form.nomeEmpresarial || !form.cnpj) return;
    if (!validateCnpj(form.cnpj)) { toast.error("CNPJ inválido!"); return; }
    if (!form.equipe) { toast.error("Selecione o Regime Tributário!"); return; }
    const cnpjDigits = cleanCnpj(form.cnpj);
    const duplicada = empresas.find((e) => cleanCnpj(e.cnpj) === cnpjDigits && e.id !== editingId);
    if (duplicada) { toast.error(`CNPJ já cadastrado para "${duplicada.nomeEmpresarial}"`); return; }
    if (editingId) {
      updateEmpresa(editingId, form);
      toast.success("Empresa atualizada com sucesso!");
    } else {
      addEmpresa(form);
      toast.success("Empresa adicionada com sucesso!");
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (empresa: Empresa) => {
    setForm({ sci: empresa.sci, nomeEmpresarial: empresa.nomeEmpresarial, cnpj: empresa.cnpj, ie: empresa.ie, municipio: empresa.municipio, tipo: empresa.tipo, equipe: empresa.equipe });
    setCnpjValid(true);
    setIsSimples(empresa.equipe === "SIMPLES NACIONAL");
    setEditingId(empresa.id);
    setOpen(true);
  };

  const resetForm = () => { setForm({ ...emptyForm }); setCnpjValid(null); setIsSimples(null); setEditingId(null); };

  // Bulk delete
  const toggleEmpresa = (id: string) => setSelectedEmpresas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAllEmpresas = () => {
    if (selectedEmpresas.length === filtered.length) setSelectedEmpresas([]);
    else setSelectedEmpresas(filtered.map((e) => e.id));
  };
  const handleBulkDelete = () => {
    if (selectedEmpresas.length === 0) return;
    removeEmpresas(selectedEmpresas);
    toast.success(`${selectedEmpresas.length} empresa(s) excluída(s).`);
    setSelectedEmpresas([]);
  };

  // Duplicar benefícios
  const origemBeneficios = useMemo(() => {
    if (!dupOrigem) return [];
    const ids = empresaBeneficios[dupOrigem] || [];
    return beneficios.filter((b) => ids.includes(b.id));
  }, [dupOrigem, empresaBeneficios, beneficios]);

  const handleDupOrigemChange = (v: string) => {
    setDupOrigem(v);
    setDupDestinos([]);
    setDupAllSelected(true);
    setDupSelectedBeneficios([]);
  };

  const handleDuplicar = () => {
    if (!dupOrigem || dupDestinos.length === 0) return;
    const idsToUse = dupAllSelected ? undefined : dupSelectedBeneficios;
    if (!dupAllSelected && dupSelectedBeneficios.length === 0) { toast.error("Selecione ao menos um benefício."); return; }
    const count = duplicarBeneficios(dupOrigem, dupDestinos, idsToUse);
    if (count > 0) toast.success(`${count} benefício(s) duplicado(s) com sucesso!`);
    else toast.info("Nenhum benefício novo para duplicar (já vinculados).");
    setDupOpen(false);
    setDupOrigem("");
    setDupDestinos([]);
    setDupSearch("");
    setDupSelectedBeneficios([]);
    setDupAllSelected(true);
  };

  const filteredDupEmpresas = empresas.filter(
    (e) => e.id !== dupOrigem && (e.nomeEmpresarial.toLowerCase().includes(dupSearch.toLowerCase()) || e.cnpj.includes(dupSearch))
  );

  const colHeaders = [
    { label: "", key: "" },
    { label: "SCI", key: "sci" },
    { label: "Nome Empresarial", key: "nomeEmpresarial" },
    { label: "CNPJ", key: "cnpj" },
    { label: "IE", key: "ie" },
    { label: "Município", key: "municipio" },
    { label: "Regime", key: "equipe" },
    { label: "", key: "" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedEmpresas.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />Excluir {selectedEmpresas.length} empresa(s)
            </Button>
          )}
          <Button variant="outline" onClick={() => exportTemplateEmpresas()}>
            <Download className="h-4 w-4 mr-2" />Baixar Modelo
          </Button>
          <Button variant="outline" onClick={() => exportEmpresasExcel(empresas)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel
          </Button>
          <ImportExcel type="empresas" />

          {/* Duplicar Dialog */}
          <Dialog open={dupOpen} onOpenChange={(v) => { setDupOpen(v); if (!v) { setDupOrigem(""); setDupDestinos([]); setDupSearch(""); setDupSelectedBeneficios([]); setDupAllSelected(true); } }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Copy className="h-4 w-4 mr-2" />Duplicar Benefícios</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Duplicar Benefícios entre Empresas</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label>Empresa de Origem</Label>
                  <Select value={dupOrigem} onValueChange={handleDupOrigemChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa de origem..." /></SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nomeEmpresarial} ({e.cnpj})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dupOrigem && <p className="text-xs text-muted-foreground">{origemBeneficios.length} benefício(s) vinculado(s)</p>}
                </div>

                {dupOrigem && origemBeneficios.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label>Benefícios a duplicar</Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={dupAllSelected} onCheckedChange={(c) => { setDupAllSelected(!!c); if (c) setDupSelectedBeneficios([]); }} />
                      <span className="text-sm font-medium">Duplicar todos</span>
                    </label>
                    {!dupAllSelected && (
                      <ScrollArea className="h-36 border rounded-md p-2">
                        {origemBeneficios.map((b) => (
                          <label key={b.id} className="flex items-center gap-2 py-1 px-1 hover:bg-accent/50 rounded cursor-pointer">
                            <Checkbox
                              checked={dupSelectedBeneficios.includes(b.id)}
                              onCheckedChange={(checked) => setDupSelectedBeneficios((prev) => checked ? [...prev, b.id] : prev.filter((x) => x !== b.id))}
                            />
                            <span className="text-xs font-mono">{b.cfopOuNcm}</span>
                            <span className="text-xs text-muted-foreground">{b.cBenef}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{b.tipo}</span>
                          </label>
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label>Empresas de Destino</Label>
                  <Input placeholder="Buscar empresa destino..." value={dupSearch} onChange={(e) => setDupSearch(e.target.value)} className="mb-1" />
                  <ScrollArea className="h-48 border rounded-md p-2">
                    {filteredDupEmpresas.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 py-1 px-1 hover:bg-accent/50 rounded cursor-pointer">
                        <Checkbox checked={dupDestinos.includes(e.id)} onCheckedChange={(checked) => setDupDestinos((prev) => checked ? [...prev, e.id] : prev.filter((x) => x !== e.id))} />
                        <span className="text-sm">{e.nomeEmpresarial}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{e.cnpj}</span>
                      </label>
                    ))}
                    {filteredDupEmpresas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa disponível</p>}
                  </ScrollArea>
                  {dupDestinos.length > 0 && <p className="text-xs text-muted-foreground">{dupDestinos.length} empresa(s) selecionada(s)</p>}
                </div>
              </div>
              <Button onClick={handleDuplicar} disabled={!dupOrigem || dupDestinos.length === 0 || origemBeneficios.length === 0} className="w-full">
                Duplicar {dupAllSelected ? "Todos os" : dupSelectedBeneficios.length} Benefício(s)
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Empresa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar Empresa" : "Adicionar Empresa"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid gap-1.5">
                  <Label>CNPJ</Label>
                  <div className="relative">
                    <Input value={form.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00"
                      className={cnpjValid === false ? "border-destructive" : cnpjValid === true ? "border-green-500" : ""} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {!loading && cnpjValid === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {!loading && cnpjValid === false && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                  {cnpjValid === false && <p className="text-xs text-destructive">CNPJ inválido</p>}
                </div>
                <div className="grid gap-1.5"><Label>SCI</Label><Input value={form.sci} onChange={(e) => setForm({ ...form, sci: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Nome Empresarial</Label><Input value={form.nomeEmpresarial} onChange={(e) => setForm({ ...form, nomeEmpresarial: e.target.value })} disabled={loading} /></div>
                <div className="grid gap-1.5"><Label>Inscrição Estadual</Label><Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} disabled={loading} /></div>
                <div className="grid gap-1.5"><Label>Município</Label><Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} disabled={loading} /></div>
                <div className="grid gap-1.5">
                  <Label>Regime Tributário</Label>
                  {isSimples ? (
                    <Input value="SIMPLES NACIONAL" disabled className="bg-green-50 text-green-700 font-medium border-green-300" />
                  ) : (
                    <Select value={form.equipe} onValueChange={(v) => setForm({ ...form, equipe: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o regime..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LUCRO PRESUMIDO">Lucro Presumido</SelectItem>
                        <SelectItem value="LUCRO REAL">Lucro Real</SelectItem>
                        <SelectItem value="SIMPLES NACIONAL">Simples Nacional</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</> : editingId ? "Salvar Alterações" : "Adicionar"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              {colHeaders.map((header, i) => (
                <TableHead key={i} className="text-secondary-foreground font-semibold relative select-none" style={{ width: colWidths[i], minWidth: i === 0 ? 40 : 50 }}>
                  {i === 0 ? (
                    <Checkbox checked={filtered.length > 0 && selectedEmpresas.length === filtered.length} onCheckedChange={toggleAllEmpresas} />
                  ) : header.key ? (
                    <span className="cursor-pointer select-none inline-flex items-center" onClick={() => handleSort(header.key)}>
                      {header.label}<SortIcon col={header.key} />
                    </span>
                  ) : header.label}
                  {i > 0 && i < colHeaders.length - 1 && (
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10" onMouseDown={(e) => handleMouseDown(i, e)} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.id} className={`hover:bg-accent/50 ${selectedEmpresas.includes(e.id) ? "bg-accent/30" : ""}`}>
                <TableCell style={{ width: colWidths[0] }}><Checkbox checked={selectedEmpresas.includes(e.id)} onCheckedChange={() => toggleEmpresa(e.id)} /></TableCell>
                <TableCell className="font-mono" style={{ width: colWidths[1] }}>{e.sci}</TableCell>
                <TableCell className="font-medium" style={{ width: colWidths[2] }}>{e.nomeEmpresarial}</TableCell>
                <TableCell className="font-mono text-sm" style={{ width: colWidths[3] }}>{e.cnpj}</TableCell>
                <TableCell className="font-mono text-sm" style={{ width: colWidths[4] }}>{e.ie}</TableCell>
                <TableCell style={{ width: colWidths[5] }}>{e.municipio}</TableCell>
                <TableCell style={{ width: colWidths[6] }}><span className="text-xs px-2 py-1 rounded-full bg-accent">{e.equipe}</span></TableCell>
                <TableCell style={{ width: colWidths[7] }}>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeEmpresa(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EmpresasTab;
