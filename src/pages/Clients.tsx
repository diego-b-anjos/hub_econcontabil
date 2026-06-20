import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClients, type Client, type CnaeSecundario } from "@/lib/api";
import { lookupCnpj, formatCNPJ, onlyDigitsCnpj } from "@/lib/cnpj";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Loader2, MapPin, Phone, Building2, FileDown, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { obrigacoesParaCliente } from "@/data/tributos";
import { ExportarCalendarioDialog } from "@/components/ExportarCalendarioDialog";

/** Cache em escopo de módulo — sobrevive ao desmonte/montagem do componente
 *  para evitar a tela em branco ao trocar de aba e voltar. */
let _clientsCache: Client[] | null = null;

const MESES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const ESFERA_LABEL: Record<string, string> = {
  federal: "Federais",
  estadual: "Estaduais",
  municipal: "Municipais",
  trabalhista: "Trabalhistas",
};

const REGIME_LABEL: Record<string, string> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
};
const REGIME_BADGE: Record<string, string> = {
  SN: "bg-green-100 text-green-800 border-green-300",
  LP: "bg-sky-100 text-sky-800 border-sky-300",
  LR: "bg-violet-100 text-violet-800 border-violet-300",
};

interface FormState {
  name: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  taxRegime: string;
  naturezaJuridica: string;
  porte: string;
  dataAbertura: string;
  situacaoCadastral: string;
  capitalSocial: string;
  activity: string;
  cnaePrincipalCodigo: string;
  cnaePrincipalDescricao: string;
  cnaesSecundarios: CnaeSecundario[];
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  telefone: string;
  telefoneSecundario: string;
  email: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "", inscricaoMunicipal: "",
  taxRegime: "", naturezaJuridica: "", porte: "", dataAbertura: "", situacaoCadastral: "",
  capitalSocial: "", activity: "", cnaePrincipalCodigo: "", cnaePrincipalDescricao: "",
  cnaesSecundarios: [],
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "",
  telefone: "", telefoneSecundario: "", email: "", notes: "",
};

/** Parser robusto para endereços-livres legados.
 *  Exemplo: "AVENIDA HILARIO PEREIRA DE SOUZA, 406, SALA 207 TORRE I ANDAR 2, CENTRO, OSASCO/SP, CEP 06010170"
 *  → logradouro, numero=406, complemento="SALA 207 TORRE I ANDAR 2", bairro=CENTRO, municipio=OSASCO, uf=SP, cep=06010170 */
function parseLegacyAddress(addr: string): Partial<FormState> {
  const out: Partial<FormState> = {};
  let resto = addr.trim();

  // 1) CEP — aceita "CEP 12345678", "CEP: 12345-678" ou só "12345-678"
  const cepM = resto.match(/CEP[:\s-]*(\d{5})-?(\d{3})/i)
    || resto.match(/(\d{5})-?(\d{3})\b/);
  if (cepM) {
    out.cep = `${cepM[1]}${cepM[2]}`;
    resto = resto.replace(cepM[0], "").replace(/,\s*,/g, ",").replace(/,\s*$/, "");
  }

  // 2) Município/UF — padrão "MUNICIPIO/UF"
  const ufBarra = resto.match(/([A-Za-zÀ-Ÿ\s.'-]+?)\s*\/\s*([A-Z]{2})\b/);
  if (ufBarra) {
    out.municipio = ufBarra[1].trim().replace(/^,\s*/, "");
    out.uf = ufBarra[2];
    resto = resto.replace(ufBarra[0], "").replace(/,\s*,/g, ",").replace(/,\s*$/, "");
  } else {
    const ufSolo = resto.match(/[,\s]([A-Z]{2})\b\s*$/);
    if (ufSolo) {
      out.uf = ufSolo[1];
      resto = resto.replace(ufSolo[0], "");
    }
  }

  // 3) Quebra o restante em partes por vírgula
  const partes = resto.split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length) {
    // Logradouro = primeira parte
    out.logradouro = partes.shift();
    // Numero = se a próxima parte for só dígitos (com possível letra)
    if (partes[0] && /^\d+[A-Za-z]?$/.test(partes[0])) {
      out.numero = partes.shift();
    }
    // Bairro = última parte (heurística: bairros vêm antes de município)
    if (partes.length) {
      out.bairro = partes.pop();
    }
    // Complemento = tudo entre número e bairro (pode ser "SALA 207 TORRE I ANDAR 2")
    if (partes.length) {
      out.complemento = partes.join(", ");
    }
  }
  return out;
}

function clientToForm(c: Client): FormState {
  // Se houver `address` legado, parseia e usamos como fallback CAMPO A CAMPO —
  // cobre cadastros parcialmente migrados (ex.: só `municipio` salvo, demais vazios).
  const legacy = c.address ? parseLegacyAddress(c.address) : {};
  return {
    name: c.name,
    nomeFantasia: c.nomeFantasia || "",
    cnpj: c.cnpj || "",
    inscricaoEstadual: c.inscricaoEstadual || "",
    inscricaoMunicipal: c.inscricaoMunicipal || "",
    taxRegime: c.taxRegime || "",
    naturezaJuridica: c.naturezaJuridica || "",
    porte: c.porte || "",
    dataAbertura: c.dataAbertura || "",
    situacaoCadastral: c.situacaoCadastral || "",
    capitalSocial: c.capitalSocial || "",
    activity: c.activity || "",
    cnaePrincipalCodigo: c.cnaePrincipalCodigo || "",
    cnaePrincipalDescricao: c.cnaePrincipalDescricao || "",
    cnaesSecundarios: c.cnaesSecundarios || [],
    cep: c.cep || legacy.cep || "",
    logradouro: c.logradouro || legacy.logradouro || "",
    numero: c.numero || legacy.numero || "",
    complemento: c.complemento || legacy.complemento || "",
    bairro: c.bairro || legacy.bairro || "",
    municipio: c.municipio || legacy.municipio || "",
    uf: c.uf || legacy.uf || "",
    telefone: c.telefone || "",
    telefoneSecundario: c.telefoneSecundario || "",
    email: c.email || "",
    notes: c.notes || "",
  };
}

function formToPayload(f: FormState): Omit<Client, "id" | "createdAt" | "updatedAt"> {
  const enderecoFormatado = [
    f.logradouro && `${f.logradouro}${f.numero ? `, ${f.numero}` : ""}`,
    f.complemento, f.bairro,
    f.municipio && f.uf && `${f.municipio}/${f.uf}`,
    f.cep && `CEP ${f.cep}`,
  ].filter(Boolean).join(", ");
  return {
    name: f.name.trim(),
    nomeFantasia: f.nomeFantasia || null,
    cnpj: f.cnpj || null,
    inscricaoEstadual: f.inscricaoEstadual || null,
    inscricaoMunicipal: f.inscricaoMunicipal || null,
    taxRegime: f.taxRegime || null,
    naturezaJuridica: f.naturezaJuridica || null,
    porte: f.porte || null,
    dataAbertura: f.dataAbertura || null,
    situacaoCadastral: f.situacaoCadastral || null,
    capitalSocial: f.capitalSocial || null,
    activity: f.activity || f.cnaePrincipalDescricao || null,
    cnaePrincipalCodigo: f.cnaePrincipalCodigo || null,
    cnaePrincipalDescricao: f.cnaePrincipalDescricao || null,
    cnaesSecundarios: f.cnaesSecundarios.length ? f.cnaesSecundarios : null,
    cep: f.cep || null,
    logradouro: f.logradouro || null,
    numero: f.numero || null,
    complemento: f.complemento || null,
    bairro: f.bairro || null,
    municipio: f.municipio || null,
    uf: f.uf || null,
    address: enderecoFormatado || null,
    telefone: f.telefone || null,
    telefoneSecundario: f.telefoneSecundario || null,
    email: f.email || null,
    notes: f.notes || null,
  };
}

export default function Clients() {
  // Hidrata imediatamente do cache de módulo (sem flash de tela vazia ao trocar de aba)
  const [items, setItems] = useState<Client[]>(_clientsCache || []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportDlg, setExportDlg] = useState<Client | null>(null);

  const load = async () => {
    try {
      const data = await apiClients.list();
      _clientsCache = data;
      setItems(data);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar clientes");
    }
  };
  // Carrega/refresh em background; cache já mostrou os dados anteriores
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm(clientToForm(c)); setOpen(true); };

  const lookupCNPJ = async () => {
    const digits = onlyDigitsCnpj(form.cnpj);
    if (digits.length !== 14) return toast.error("Informe um CNPJ válido (14 dígitos)");
    const dup = items.find((c) => onlyDigitsCnpj(c.cnpj || "") === digits && c.id !== editing?.id);
    if (dup) return toast.error(`Esse CNPJ já está cadastrado para "${dup.name}"`);
    setLookingUp(true);
    try {
      const d = await lookupCnpj(digits);
      setForm((f) => ({
        ...f,
        cnpj: formatCNPJ(digits),
        name: d.razaoSocial || f.name,
        nomeFantasia: d.nomeFantasia || f.nomeFantasia,
        activity: d.cnaePrincipalDescricao || f.activity,
        cnaePrincipalCodigo: d.cnaePrincipalCodigo || f.cnaePrincipalCodigo,
        cnaePrincipalDescricao: d.cnaePrincipalDescricao || f.cnaePrincipalDescricao,
        cnaesSecundarios: d.cnaesSecundarios.length ? d.cnaesSecundarios : f.cnaesSecundarios,
        cep: d.cep || f.cep,
        logradouro: d.logradouro || f.logradouro,
        numero: d.numero || f.numero,
        complemento: d.complemento || f.complemento,
        bairro: d.bairro || f.bairro,
        municipio: d.municipio || f.municipio,
        uf: d.uf || f.uf,
        telefone: d.telefone || f.telefone,
        telefoneSecundario: d.telefoneSecundario || f.telefoneSecundario,
        email: d.email || f.email,
        naturezaJuridica: d.naturezaJuridica || f.naturezaJuridica,
        porte: d.porte || f.porte,
        dataAbertura: d.dataAbertura || f.dataAbertura,
        situacaoCadastral: d.situacaoCadastral || f.situacaoCadastral,
        capitalSocial: d.capitalSocial || f.capitalSocial,
        taxRegime: d.taxRegime || f.taxRegime,
      }));
      toast.success("Dados do CNPJ preenchidos");
    } catch (e: any) {
      toast.error(e.message || "Falha ao consultar CNPJ");
    } finally {
      setLookingUp(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome / razão social");
    const cnpjDigits = onlyDigitsCnpj(form.cnpj);
    if (cnpjDigits) {
      if (cnpjDigits.length !== 14) return toast.error("CNPJ inválido — informe os 14 dígitos");
      const dup = items.find((c) => onlyDigitsCnpj(c.cnpj || "") === cnpjDigits && c.id !== editing?.id);
      if (dup) return toast.error(`CNPJ já cadastrado para "${dup.name}"`);
    } else {
      const dupName = items.find(
        (c) => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== editing?.id,
      );
      if (dupName) return toast.error(`Já existe um cliente com o nome "${dupName.name}"`);
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await apiClients.update(editing.id, payload);
        toast.success("Cliente atualizado");
      } else {
        await apiClients.create(payload);
        toast.success("Cliente criado");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    try {
      await apiClients.remove(id);
      _clientsCache = null;
      toast.success("Cliente excluído");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const abrirExport = (c: Client) => {
    setExportDlg(c);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre os clientes do escritório. Informe o CNPJ e clique em buscar para preencher
            todos os campos automaticamente (Razão Social, CNAEs, endereço, telefone, regime).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-brand text-brand-foreground hover:bg-brand/90 shadow-brand">
              <Plus className="w-4 h-4 mr-2" /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Aviso de cadastro legado/incompleto — só name/cnpj/address salvos no DB */}
              {editing && editing.address && (
                !form.naturezaJuridica || !form.porte || !form.cnaePrincipalCodigo || !form.inscricaoEstadual
              ) && (
                <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900">Cadastro com dados incompletos no banco</p>
                    <p className="text-xs text-yellow-800 mt-1">
                      Esse cliente foi importado em formato antigo — apenas <strong>razão social</strong>,
                      <strong> CNPJ</strong> e <strong>endereço</strong> em texto livre estavam salvos.
                      Os campos vazios abaixo (IE, IM, natureza jurídica, porte, situação cadastral, CNAEs, etc.)
                      <strong> nunca foram cadastrados no banco</strong>.
                    </p>
                    {editing.address && (
                      <p className="text-[11px] text-yellow-800 mt-1.5 italic">
                        Endereço original: "{editing.address}" — separado em logradouro/número/bairro/município/UF/CEP automaticamente.
                      </p>
                    )}
                    <p className="text-xs text-yellow-900 mt-2 font-medium">
                      → Clique em <strong>"Buscar dados"</strong> abaixo para preencher tudo automaticamente via consulta CNPJ na BrasilAPI / ReceitaWS, depois salve.
                    </p>
                  </div>
                </div>
              )}

              {/* Bloco CNPJ + lookup */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">CNPJ — busca automática</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupCNPJ(); } }}
                  />
                  <Button type="button" variant="default" onClick={lookupCNPJ} disabled={lookingUp}>
                    {lookingUp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    Buscar dados
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Consulta BrasilAPI / ReceitaWS. Preenche razão social, fantasia, CNAEs, endereço,
                  telefone, e-mail, situação cadastral, natureza jurídica, porte e data de abertura.
                </p>
              </div>

              {/* Identificação */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Identificação
                </h3>
                <div className="space-y-1.5">
                  <Label>Razão social *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome fantasia</Label>
                    <Input value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Regime tributário</Label>
                    <Select value={form.taxRegime || "_none"} onValueChange={(v) => setForm({ ...form, taxRegime: v === "_none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Não definido</SelectItem>
                        <SelectItem value="SN">Simples Nacional</SelectItem>
                        <SelectItem value="LP">Lucro Presumido</SelectItem>
                        <SelectItem value="LR">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Inscrição estadual</Label>
                    <Input value={form.inscricaoEstadual} onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })} placeholder="ISENTO se for o caso" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Inscrição municipal</Label>
                    <Input value={form.inscricaoMunicipal} onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Natureza jurídica</Label>
                    <Input value={form.naturezaJuridica} onChange={(e) => setForm({ ...form, naturezaJuridica: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Porte</Label>
                    <Input value={form.porte} onChange={(e) => setForm({ ...form, porte: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação cadastral</Label>
                    <Input value={form.situacaoCadastral} onChange={(e) => setForm({ ...form, situacaoCadastral: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data de abertura</Label>
                    <Input type="date" value={form.dataAbertura} onChange={(e) => setForm({ ...form, dataAbertura: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Capital social</Label>
                    <Input value={form.capitalSocial} onChange={(e) => setForm({ ...form, capitalSocial: e.target.value })} />
                  </div>
                </div>
              </section>

              {/* Atividade / CNAEs */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm">Atividade econômica</h3>
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <div className="space-y-1.5">
                    <Label>CNAE principal</Label>
                    <Input value={form.cnaePrincipalCodigo} onChange={(e) => setForm({ ...form, cnaePrincipalCodigo: e.target.value })} placeholder="0000000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descrição CNAE principal</Label>
                    <Input value={form.cnaePrincipalDescricao} onChange={(e) => setForm({ ...form, cnaePrincipalDescricao: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>CNAEs secundários ({form.cnaesSecundarios.length})</Label>
                  {form.cnaesSecundarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhum CNAE secundário. Use a busca por CNPJ para preencher automaticamente.
                    </p>
                  ) : (
                    <div className="border rounded-md max-h-32 overflow-y-auto divide-y">
                      {form.cnaesSecundarios.map((c, i) => (
                        <div key={`${c.codigo}-${i}`} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                          <Badge variant="outline" className="font-mono text-[10px]">{c.codigo}</Badge>
                          <span className="flex-1 truncate">{c.descricao}</span>
                          <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => setForm({ ...form, cnaesSecundarios: form.cnaesSecundarios.filter((_, j) => j !== i) })}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Atividade (descrição livre)</Label>
                  <Input value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}
                    placeholder="Ex.: Contabilidade, comércio varejista" />
                </div>
              </section>

              {/* Endereço */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Endereço
                </h3>
                <div className="grid grid-cols-[120px_1fr_120px] gap-3">
                  <div className="space-y-1.5">
                    <Label>CEP</Label>
                    <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="00000000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Logradouro</Label>
                    <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número</Label>
                    <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Complemento</Label>
                    <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <div className="space-y-1.5">
                    <Label>Município</Label>
                    <Input value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Município e UF serão usados para vincular este cliente às obrigações estaduais
                  (ICMS/ST/DIFAL/GIA) e municipais (ISS/NFS-e) corretas no calendário.
                </p>
              </section>

              {/* Contato */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" /> Contato
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefone principal</Label>
                    <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone secundário</Label>
                    <Input value={form.telefoneSecundario} onChange={(e) => setForm({ ...form, telefoneSecundario: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com.br" />
                </div>
              </section>

              {/* Notas */}
              <section className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </section>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</> : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Diálogo unificado de exportação (Por mês ou Apenas obrigações) */}
      {exportDlg && (
        <ExportarCalendarioDialog
          open={!!exportDlg}
          onOpenChange={(o) => !o && setExportDlg(null)}
          cliente={{
            nome: exportDlg.name,
            cnpj: exportDlg.cnpj,
            municipio: exportDlg.municipio,
            uf: exportDlg.uf,
            taxRegime: exportDlg.taxRegime,
          }}
          getObrigacoes={(mes) => obrigacoesParaCliente(mes, {
            municipio: exportDlg.municipio,
            uf: exportDlg.uf,
            taxRegime: exportDlg.taxRegime,
          })}
          fileBase={`calendario-${exportDlg.name.replace(/\s+/g, "_").toLowerCase()}-${new Date().getFullYear()}`}
        />
      )}

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum cliente cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <Card key={c.id} className="shadow-card hover:shadow-elegant transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{c.name}</div>
                    {c.nomeFantasia && (
                      <div className="text-[11px] text-muted-foreground italic truncate">{c.nomeFantasia}</div>
                    )}
                    {(c.cnaePrincipalDescricao || c.activity) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.cnaePrincipalDescricao || c.activity}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.taxRegime && (
                    <Badge variant="outline" className={`text-[10px] ${REGIME_BADGE[c.taxRegime] || ""}`}>
                      {REGIME_LABEL[c.taxRegime] || c.taxRegime}
                    </Badge>
                  )}
                  {c.municipio && c.uf && (
                    <Badge variant="outline" className="text-[10px]">{c.municipio}/{c.uf}</Badge>
                  )}
                  {c.porte && (
                    <Badge variant="outline" className="text-[10px]">{c.porte}</Badge>
                  )}
                </div>
                {c.cnpj && <div className="text-xs text-muted-foreground">CNPJ: {c.cnpj}</div>}
                {c.telefone && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" /> {c.telefone}
                  </div>
                )}
                {(c.address || c.logradouro) && (
                  <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{c.address || `${c.logradouro}${c.numero ? `, ${c.numero}` : ""} — ${c.municipio || ""}/${c.uf || ""}`}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link to={`/app/simulacoes/nova?cliente=${c.id}`}>Simulação</Link>
                  </Button>
                  <Button
                    size="sm" variant="outline" className="text-xs"
                    onClick={() => abrirExport(c)}
                  >
                    <FileDown className="w-3 h-3 mr-1" />
                    Calendário
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
