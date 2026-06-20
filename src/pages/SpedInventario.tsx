import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, X, Save, Trash2, Loader2, Search,
  Package, DollarSign, Hash, Download, Copy, Check,
  FileText, AlertCircle, AlertTriangle, Database,
} from "lucide-react";
import { toast } from "sonner";
import { parseExcelFile } from "@/lib/sped/excel-parser";
import { generateFullSped } from "@/lib/sped/sped-generator";
import {
  formatCNPJ, formatIE, isValidCNPJ, fetchCNPJData,
} from "@/lib/sped/cnpj-utils";
import {
  type InventoryItem, type ClientData, type InventoryMeta, type ValidationWarning,
  MOTIVOS_INVENTARIO, UFS, PERFIS, VERSOES_SPED,
} from "@/lib/sped/types";

const STORAGE_KEY_CONTRIBUTOR = "sped_contributor_data";
const STORAGE_KEY_ACCOUNTANT = "sped_accountant_data";
const STORAGE_KEY_META = "sped_meta_data";

const contributorFields = [
  "razaoSocial","cnpj","inscricaoEstadual","uf","codigoMunicipio","endereco","numero",
  "complemento","bairro","cep","telefone","email","codFinalidade","perfil",
] as const;

const accountantFields = ["contabilistaNome","contabilistaCpf","contabilistaCrc","contabilistaCnpj"] as const;

function readFromStorage<T>(key: string): Partial<T> | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as Partial<T>) : null;
  } catch { return null; }
}

function pickFields<T, K extends keyof T>(source: T, keys: readonly K[]): Pick<T, K> {
  return keys.reduce((acc, key) => { acc[key] = source[key]; return acc; }, {} as Pick<T, K>);
}

const defaultClient: ClientData = {
  razaoSocial: "", cnpj: "", inscricaoEstadual: "", uf: "", codigoMunicipio: "",
  endereco: "", numero: "", complemento: "", bairro: "", cep: "", telefone: "",
  email: "", codFinalidade: "0", perfil: "B",
  contabilistaNome: "", contabilistaCpf: "", contabilistaCrc: "", contabilistaCnpj: "",
};

const defaultMeta: InventoryMeta = {
  dataInventario: "", motivoInventario: "", dataInicial: "", dataFinal: "",
  versaoSped: "020", contaContabilPadrao: "",
};

export default function SpedInventario() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [client, setClient] = useState<ClientData>(() => ({
    ...defaultClient,
    ...readFromStorage<ClientData>(STORAGE_KEY_CONTRIBUTOR),
    ...readFromStorage<ClientData>(STORAGE_KEY_ACCOUNTANT),
  }));
  const [meta, setMeta] = useState<InventoryMeta>(() => ({
    ...defaultMeta,
    ...readFromStorage<InventoryMeta>(STORAGE_KEY_META),
  }));
  const [spedContent, setSpedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  const handleFileSelect = async (file: File) => {
    setError(""); setSpedContent(""); setWarnings([]); setIsLoading(true);
    try {
      const result = await parseExcelFile(file);
      setItems(result.items);
      setWarnings(result.warnings);
      toast.success(`${result.items.length} itens importados com sucesso!`);
      if (result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} aviso(s) de validação encontrado(s)`);
      }
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
      toast.error("Erro ao importar planilha");
    } finally { setIsLoading(false); }
  };

  const validateAndGenerate = () => {
    if (!client.cnpj || client.cnpj.replace(/\D/g, "").length < 14) return toast.error("Informe o CNPJ do contribuinte");
    if (!client.razaoSocial.trim()) return toast.error("Informe a Razão Social");
    if (!client.uf) return toast.error("Selecione a UF");
    if (!client.inscricaoEstadual.trim()) return toast.error("Informe a Inscrição Estadual");
    if (!client.codigoMunicipio || client.codigoMunicipio.length < 7) return toast.error("Informe o Código do Município (IBGE) com 7 dígitos");
    if (!client.contabilistaNome.trim()) return toast.error("Informe o Nome do Contabilista");
    if (!client.contabilistaCpf || client.contabilistaCpf.replace(/\D/g, "").length < 11) return toast.error("Informe o CPF do Contabilista");
    if (!client.contabilistaCrc.trim()) return toast.error("Informe o CRC do Contabilista");
    if (!meta.dataInventario) return toast.error("Informe a data do inventário");
    if (!meta.motivoInventario) return toast.error("Selecione o motivo do inventário");
    if (!meta.dataInicial || !meta.dataFinal) return toast.error("Informe o período (data inicial e final)");
    setSpedContent(generateFullSped(items, meta, client));
    toast.success("Arquivo SPED gerado com sucesso!");
  };

  const canGenerate = Boolean(
    items.length > 0 && meta.dataInventario && meta.motivoInventario &&
    meta.dataInicial && meta.dataFinal &&
    client.cnpj.replace(/\D/g, "").length >= 14 && client.razaoSocial.trim() &&
    client.uf && client.inscricaoEstadual.trim() && client.codigoMunicipio.length >= 7 &&
    client.contabilistaNome.trim() && client.contabilistaCpf.replace(/\D/g, "").length >= 11 &&
    client.contabilistaCrc.trim()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-brand/15 text-brand flex items-center justify-center">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">SPED Inventário</h1>
          <p className="text-sm text-muted-foreground">Gerador do Bloco H — SPED Fiscal.</p>
        </div>
      </div>

      <Section step="1" title="Importar Planilha de Estoque">
        <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive mt-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
          </div>
        )}
      </Section>

      {warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Avisos de Validação ({warnings.length})</h3>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 p-4">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300">⚠ {w.mensagem}</p>
            ))}
          </div>
        </div>
      )}

      <Section step="2" title="Dados separados por bloco">
        <ClientForm client={client} meta={meta} onClientChange={setClient} onMetaChange={setMeta} />
      </Section>

      {items.length > 0 && (
        <Section step="3" title="Dados Importados">
          <DataPreview items={items} />
        </Section>
      )}

      {items.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button size="lg" onClick={validateAndGenerate} disabled={!canGenerate} className="px-8 bg-brand text-brand-foreground hover:bg-brand/90 shadow-brand">
            <FileText className="mr-2 h-4 w-4" />
            Gerar Arquivo SPED Completo
          </Button>
        </div>
      )}

      {spedContent && (
        <Section step="4" title="Resultado">
          <SpedPreview content={spedContent} />
        </Section>
      )}
    </div>
  );
}

// ========== Section ==========
function Section({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">{step}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ========== FormSection ==========
function FormSection({ title, description, onSave, onClear, children }: {
  title: string; description: string; onSave: () => void; onClear: () => void; children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onSave}>
              <Save className="mr-1 h-3.5 w-3.5" /> Salvar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ========== FileUpload ==========
function FileUpload({ onFileSelect, isLoading }: { onFileSelect: (f: File) => void; isLoading?: boolean }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file); onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); onFileSelect(file); }
  }, [onFileSelect]);

  return (
    <Card className={`border-2 border-dashed transition-colors ${dragActive ? "border-brand bg-brand/5" : ""}`}>
      <CardContent className="p-8">
        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} disabled={isLoading}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-3 cursor-pointer"
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-brand" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">
                Arraste sua planilha ou <span className="text-brand underline">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</p>
            </div>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleChange} />
          </label>
        )}
      </CardContent>
    </Card>
  );
}

// ========== DataPreview ==========
function DataPreview({ items }: { items: InventoryItem[] }) {
  const totalEstoque = items.reduce((s, i) => s + i.valorTotal, 0);
  const totalQtd = items.reduce((s, i) => s + i.quantidade, 0);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center"><Hash className="w-4 h-4 text-brand" /></div>
          <div><p className="text-xs text-muted-foreground">Itens</p><p className="text-lg font-bold">{items.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center"><Package className="w-4 h-4 text-brand" /></div>
          <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="text-lg font-bold">{totalQtd.toLocaleString("pt-BR")}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center"><DollarSign className="w-4 h-4 text-brand" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{fmt(totalEstoque)}</p></div>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Itens do Inventário</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[100px]">NCM</TableHead>
                  <TableHead className="w-[60px]">UN</TableHead>
                  <TableHead className="text-right w-[80px]">Qtd</TableHead>
                  <TableHead className="text-right w-[110px]">Vl. Unit.</TableHead>
                  <TableHead className="text-right w-[110px]">Vl. Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={`${item.codigo}-${i}`}>
                    <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">{item.descricao}</TableCell>
                    <TableCell className="font-mono text-xs">{item.ncm}</TableCell>
                    <TableCell className="text-xs">{item.unidade}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{item.quantidade.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(item.valorUnitario)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium">{fmt(item.valorTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== SpedPreview ==========
function SpedPreview({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "bloco_h_sped.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium">Arquivo SPED Gerado</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button size="sm" onClick={handleDownload} className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Download className="w-3.5 h-3.5 mr-1" /> Download
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-auto max-h-[400px] leading-relaxed">{content}</pre>
      </CardContent>
    </Card>
  );
}

// ========== ClientForm ==========
function ClientForm({ client, meta, onClientChange, onMetaChange }: {
  client: ClientData; meta: InventoryMeta;
  onClientChange: (c: ClientData) => void; onMetaChange: (m: InventoryMeta) => void;
}) {
  const [fetching, setFetching] = useState(false);

  const handleFetchCNPJ = async () => {
    if (!isValidCNPJ(client.cnpj)) return toast.error("CNPJ inválido");
    setFetching(true);
    try {
      const data = await fetchCNPJData(client.cnpj);
      if (data) {
        onClientChange({ ...client, ...data });
        toast.success("Dados do CNPJ carregados!");
      } else { toast.error("Não foi possível consultar o CNPJ"); }
    } catch { toast.error("Erro ao consultar CNPJ"); }
    finally { setFetching(false); }
  };

  const saveContributor = () => {
    localStorage.setItem(STORAGE_KEY_CONTRIBUTOR, JSON.stringify(pickFields(client, contributorFields)));
    toast.success("Dados do contribuinte salvos!");
  };
  const clearContributor = () => {
    localStorage.removeItem(STORAGE_KEY_CONTRIBUTOR);
    onClientChange({ ...client, ...pickFields(defaultClient, contributorFields) });
    toast.success("Dados do contribuinte limpos!");
  };
  const saveAccountant = () => {
    localStorage.setItem(STORAGE_KEY_ACCOUNTANT, JSON.stringify(pickFields(client, accountantFields)));
    toast.success("Dados do contador salvos!");
  };
  const clearAccountant = () => {
    localStorage.removeItem(STORAGE_KEY_ACCOUNTANT);
    onClientChange({ ...client, ...pickFields(defaultClient, accountantFields) });
    toast.success("Dados do contador limpos!");
  };
  const saveMeta = () => {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
    toast.success("Dados de inventário e período salvos!");
  };
  const clearMeta = () => {
    localStorage.removeItem(STORAGE_KEY_META);
    onMetaChange(defaultMeta);
    toast.success("Dados de inventário e período limpos!");
  };

  return (
    <div className="grid gap-6">
      <FormSection title="Bloco 0 — Dados do Contribuinte" description="Registros 0000 e 0005" onSave={saveContributor} onClear={clearContributor}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input value={client.cnpj} onChange={(e) => onClientChange({ ...client, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" maxLength={18} />
              <Button type="button" variant="outline" size="icon" onClick={handleFetchCNPJ} disabled={fetching || client.cnpj.replace(/\D/g, "").length < 14}>
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição Estadual</Label>
            <Input value={client.inscricaoEstadual} onChange={(e) => onClientChange({ ...client, inscricaoEstadual: formatIE(e.target.value) })} maxLength={14} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Razão Social</Label>
            <Input value={client.razaoSocial} onChange={(e) => onClientChange({ ...client, razaoSocial: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input value={client.endereco} onChange={(e) => onClientChange({ ...client, endereco: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Número</Label><Input value={client.numero} onChange={(e) => onClientChange({ ...client, numero: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Complemento</Label><Input value={client.complemento} onChange={(e) => onClientChange({ ...client, complemento: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Bairro</Label><Input value={client.bairro} onChange={(e) => onClientChange({ ...client, bairro: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Select value={client.uf} onValueChange={(v) => onClientChange({ ...client, uf: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input value={client.cep} onChange={(e) => onClientChange({ ...client, cep: e.target.value.replace(/\D/g, "").slice(0, 8) })} maxLength={8} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cód. Município (IBGE)</Label>
            <Input value={client.codigoMunicipio} onChange={(e) => onClientChange({ ...client, codigoMunicipio: e.target.value.replace(/\D/g, "").slice(0, 7) })} maxLength={7} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={client.telefone} onChange={(e) => onClientChange({ ...client, telefone: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={client.email} onChange={(e) => onClientChange({ ...client, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil do Contribuinte</Label>
            <Select value={client.perfil} onValueChange={(v) => onClientChange({ ...client, perfil: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PERFIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Bloco 0 — Dados do Contador (Registro 0100)" description="Informações obrigatórias do contabilista" onSave={saveAccountant} onClear={clearAccountant}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Nome do Contabilista *</Label><Input value={client.contabilistaNome} onChange={(e) => onClientChange({ ...client, contabilistaNome: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>CPF do Contabilista *</Label><Input value={client.contabilistaCpf} onChange={(e) => onClientChange({ ...client, contabilistaCpf: e.target.value.replace(/\D/g, "").slice(0, 11) })} maxLength={11} /></div>
          <div className="space-y-1.5"><Label>CRC *</Label><Input value={client.contabilistaCrc} onChange={(e) => onClientChange({ ...client, contabilistaCrc: e.target.value })} placeholder="Ex: 1SP000000/O-0" /></div>
          <div className="space-y-1.5"><Label>CNPJ do Escritório</Label><Input value={client.contabilistaCnpj} onChange={(e) => onClientChange({ ...client, contabilistaCnpj: e.target.value.replace(/\D/g, "").slice(0, 14) })} maxLength={14} /></div>
        </div>
      </FormSection>

      <FormSection title="Blocos 0, E e H — Inventário e Período" description="Período da escrituração, motivo, data do inventário e conta padrão" onSave={saveMeta} onClear={clearMeta}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Versão do SPED Fiscal</Label>
            <Select value={meta.versaoSped} onValueChange={(v) => onMetaChange({ ...meta, versaoSped: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VERSOES_SPED.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo do Inventário</Label>
            <Select value={meta.motivoInventario} onValueChange={(v) => onMetaChange({ ...meta, motivoInventario: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>{MOTIVOS_INVENTARIO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Data Inicial do Período</Label><Input type="date" value={meta.dataInicial} onChange={(e) => onMetaChange({ ...meta, dataInicial: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Data Final do Período</Label><Input type="date" value={meta.dataFinal} onChange={(e) => onMetaChange({ ...meta, dataFinal: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Data do Inventário</Label><Input type="date" value={meta.dataInventario} onChange={(e) => onMetaChange({ ...meta, dataInventario: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Conta Contábil Padrão</Label>
            <Input value={meta.contaContabilPadrao} onChange={(e) => onMetaChange({ ...meta, contaContabilPadrao: e.target.value })} placeholder="Ex: 1.01.04.01" />
            <p className="text-[10px] text-muted-foreground">Usada quando não informada na planilha</p>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
