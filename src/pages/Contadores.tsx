import { useEffect, useState } from "react";
import { apiContadores, type Contador } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Archive, ArchiveRestore, Loader2, BadgeCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FormState {
  name: string;
  crc: string;
  crcUf: string;
  oab: string;
  email: string;
  telefone: string;
  especialidade: string;
}

const empty: FormState = { name: "", crc: "", crcUf: "", oab: "", email: "", telefone: "", especialidade: "" };

export default function Contadores() {
  const [items, setItems] = useState<Contador[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await apiContadores.list();
      setItems(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar contadores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const startCreate = () => { setEditingId(null); setForm(empty); setOpen(true); };
  const startEdit = (c: Contador) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      crc: c.crc,
      crcUf: c.crcUf || "",
      oab: c.oab || "",
      email: c.email || "",
      telefone: c.telefone || "",
      especialidade: c.especialidade || "",
    });
    setOpen(true);
  };

  const onSave = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório.");
    if (!form.crc.trim()) return toast.error("CRC obrigatório.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        crc: form.crc.trim(),
        crcUf: form.crcUf.trim() || null,
        oab: form.oab.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        especialidade: form.especialidade.trim() || null,
      };
      if (editingId) {
        await apiContadores.update(editingId, payload);
        toast.success("Contador atualizado.");
      } else {
        await apiContadores.create(payload);
        toast.success("Contador cadastrado.");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const onArchive = async (c: Contador) => {
    const action = c.archived ? "reativar" : "arquivar";
    if (!confirm(`Deseja ${action} ${c.name}?`)) return;
    try {
      await apiContadores.update(c.id, { archived: !c.archived });
      toast.success(c.archived ? "Contador reativado." : "Contador arquivado.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  };

  const visiveis = items.filter((c) => showArchived ? true : !c.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Cadastros</div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <BadgeCheck className="w-7 h-7 text-brand" /> Contadores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profissionais responsáveis pelos relatórios. CRC obrigatório — usado nas assinaturas dos PDFs e apresentações.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo contador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar contador" : "Novo contador"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crc">CRC *</Label>
                <Input id="crc" placeholder="Ex.: 123456/O-7" value={form.crc} onChange={(e) => setForm({ ...form, crc: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crcUf">UF do CRC</Label>
                <Input id="crcUf" maxLength={2} placeholder="SP" value={form.crcUf} onChange={(e) => setForm({ ...form, crcUf: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oab">OAB (opcional)</Label>
                <Input id="oab" value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="especialidade">Especialidade</Label>
                <Input id="especialidade" placeholder="Tributário, Trabalhista..." value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={onSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          ) : visiveis.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? <>Nenhum contador cadastrado. Clique em <strong>Novo contador</strong> para começar.</>
                : "Nenhum contador ativo. Ative o filtro abaixo para ver arquivados."}
              <div className="flex items-center justify-center gap-2 pt-4">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-arch" />
                <label htmlFor="show-arch" className="text-xs">Mostrar arquivados</label>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/20">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-arch-top" />
                <label htmlFor="show-arch-top" className="text-xs">Mostrar arquivados</label>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5">Nome</th>
                    <th className="text-left px-4 py-2.5">CRC</th>
                    <th className="text-left px-4 py-2.5">OAB</th>
                    <th className="text-left px-4 py-2.5">Especialidade</th>
                    <th className="text-left px-4 py-2.5">Contato</th>
                    <th className="text-right px-4 py-2.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.id} className={`border-t hover:bg-muted/20 ${c.archived ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2.5 font-medium">
                        {c.name}{c.archived && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(arquivado)</span>}
                      </td>
                      <td className="px-4 py-2.5">{c.crc}{c.crcUf ? ` / ${c.crcUf}` : ""}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.oab || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.especialidade || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {c.email && <div>{c.email}</div>}
                        {c.telefone && <div>{c.telefone}</div>}
                        {!c.email && !c.telefone && "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(c)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onArchive(c)} title={c.archived ? "Reativar" : "Arquivar"}>
                          {c.archived ? <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" /> : <Archive className="w-3.5 h-3.5 text-amber-600" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
