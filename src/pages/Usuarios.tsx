import { useEffect, useState } from "react";
import { apiUsers, apiContadores, type User, type Contador } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Archive, ArchiveRestore, Loader2, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FormState {
  name: string;
  email: string;
  role: string;
  contadorId: string;
}

const empty: FormState = { name: "", email: "", role: "admin", contadorId: "__none__" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  operador: "Operador",
  visualizador: "Visualizador",
};

export default function Usuarios() {
  const [items, setItems] = useState<User[]>([]);
  const [contadores, setContadores] = useState<Contador[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([apiUsers.list(), apiContadores.list()]);
      setItems(u);
      setContadores(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const startCreate = () => { setEditingId(null); setForm(empty); setOpen(true); };
  const startEdit = (u: User) => {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role || "admin",
      contadorId: u.contadorId || "__none__",
    });
    setOpen(true);
  };

  const onSave = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório.");
    if (!form.email.trim()) return toast.error("E-mail obrigatório.");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        contadorId: form.contadorId === "__none__" ? null : form.contadorId,
      };
      if (editingId) {
        await apiUsers.update(editingId, payload);
        toast.success("Usuário atualizado.");
      } else {
        await apiUsers.create(payload);
        toast.success("Usuário cadastrado.");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const onArchive = async (u: User) => {
    const action = u.archived ? "reativar" : "arquivar";
    if (!confirm(`Deseja ${action} ${u.name}?`)) return;
    try {
      await apiUsers.update(u.id, { archived: !u.archived });
      toast.success(u.archived ? "Usuário reativado." : "Usuário arquivado.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    }
  };

  const contadorName = (id: string | null) => contadores.find((c) => c.id === id)?.name || "—";
  const visiveis = items.filter((u) => showArchived ? true : !u.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Cadastros</div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <UserCog className="w-7 h-7 text-brand" /> Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pessoas com acesso ao sistema. Vincule a um contador cadastrado para que os relatórios usem o CRC correto.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contador vinculado</Label>
                <Select value={form.contadorId} onValueChange={(v) => setForm({ ...form, contadorId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem vínculo —</SelectItem>
                    {contadores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.crc ? `(${c.crc})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quando vinculado, o nome e CRC do contador são usados nos PDFs e apresentações geradas por este usuário.
                </p>
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
              {items.length === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário ativo."}
              <div className="flex items-center justify-center gap-2 pt-4">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-arch-u" />
                <label htmlFor="show-arch-u" className="text-xs">Mostrar arquivados</label>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-end gap-2 px-4 py-2 border-b bg-muted/20">
                <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-arch-u-top" />
                <label htmlFor="show-arch-u-top" className="text-xs">Mostrar arquivados</label>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5">Nome</th>
                    <th className="text-left px-4 py-2.5">E-mail</th>
                    <th className="text-left px-4 py-2.5">Papel</th>
                    <th className="text-left px-4 py-2.5">Contador</th>
                    <th className="text-right px-4 py-2.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((u) => (
                    <tr key={u.id} className={`border-t hover:bg-muted/20 ${u.archived ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2.5 font-medium">
                        {u.name}{u.archived && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(arquivado)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{ROLE_LABELS[u.role] || u.role}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{contadorName(u.contadorId)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(u)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onArchive(u)} title={u.archived ? "Reativar" : "Arquivar"}>
                          {u.archived ? <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" /> : <Archive className="w-3.5 h-3.5 text-amber-600" />}
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
