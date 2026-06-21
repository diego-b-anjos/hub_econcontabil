import { useState, useRef, useCallback } from "react";
import { Plus, X, GripVertical, Tag, AlertCircle, Clock, CheckCircle2, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Priority = "baixa" | "media" | "alta";
type ColumnId = "todo" | "doing" | "review" | "done";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  tag?: string;
  column: ColumnId;
  createdAt: string;
}

const COLUMNS: { id: ColumnId; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { id: "todo",   label: "A Fazer",       icon: <Clock className="w-4 h-4" />,         color: "text-zinc-500",  bg: "bg-zinc-100" },
  { id: "doing",  label: "Em Andamento",  icon: <AlertCircle className="w-4 h-4" />,    color: "text-blue-600",  bg: "bg-blue-50"  },
  { id: "review", label: "Em Revisão",    icon: <Eye className="w-4 h-4" />,            color: "text-yellow-600",bg: "bg-yellow-50"},
  { id: "done",   label: "Concluído",     icon: <CheckCircle2 className="w-4 h-4" />,   color: "text-green-600", bg: "bg-green-50" },
];

const PRIORITY_STYLES: Record<Priority, { label: string; badge: string }> = {
  baixa: { label: "Baixa",  badge: "bg-zinc-100 text-zinc-600 border-zinc-200"  },
  media: { label: "Média",  badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  alta:  { label: "Alta",   badge: "bg-red-100 text-red-600 border-red-200"     },
};

const STORAGE_KEY = "econ:tarefas:v1";

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultTasks();
  } catch {
    return defaultTasks();
  }
}

function defaultTasks(): Task[] {
  return [
    { id: "1", title: "Revisar declarações de IR", description: "Conferir todas as declarações pendentes do mês.", priority: "alta", tag: "Fiscal", column: "todo", createdAt: new Date().toISOString() },
    { id: "2", title: "Atualizar cadastro de clientes", priority: "media", tag: "Cadastro", column: "doing", createdAt: new Date().toISOString() },
    { id: "3", title: "Gerar relatório trimestral", priority: "baixa", tag: "Relatório", column: "done", createdAt: new Date().toISOString() },
  ];
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "media" as Priority, tag: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);

  const dragOverTask = useRef<string | null>(null);

  const persist = useCallback((next: Task[]) => {
    setTasks(next);
    saveTasks(next);
  }, []);

  function openCreate(col: ColumnId = "todo") {
    setEditTask({ id: "", title: "", priority: "media", column: col, createdAt: "" });
    setForm({ title: "", description: "", priority: "media", tag: "" });
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditTask(task);
    setForm({ title: task.title, description: task.description ?? "", priority: task.priority, tag: task.tag ?? "" });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !editTask) return;
    if (editTask.id) {
      persist(tasks.map(t => t.id === editTask.id ? { ...t, ...form } : t));
    } else {
      const task: Task = { id: newId(), ...form, column: editTask.column, createdAt: new Date().toISOString() };
      persist([...tasks, task]);
    }
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    persist(tasks.filter(t => t.id !== id));
    setDialogOpen(false);
  }

  // Drag and drop
  function onDragStart(id: string) { setDragId(id); }
  function onDragEnd() { setDragId(null); setDragOverCol(null); dragOverTask.current = null; }

  function onDropColumn(col: ColumnId) {
    if (!dragId) return;
    persist(tasks.map(t => t.id === dragId ? { ...t, column: col } : t));
    setDragOverCol(null);
    setDragId(null);
  }

  function onDragOverTask(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    dragOverTask.current = overId;
    const overTask = tasks.find(t => t.id === overId);
    if (!overTask) return;
    const reordered = [...tasks];
    const fromIdx = reordered.findIndex(t => t.id === dragId);
    const toIdx = reordered.findIndex(t => t.id === overId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, { ...moved, column: overTask.column });
    setTasks(reordered);
  }

  const tasksByCol = (col: ColumnId) => tasks.filter(t => t.column === col);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quadro Kanban do escritório</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colTasks = tasksByCol(col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              className={`flex flex-col gap-3 rounded-xl p-3 border transition-colors min-h-[400px] ${isOver ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDropColumn(col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <div className={`flex items-center gap-2 font-semibold text-sm ${col.color}`}>
                  {col.icon}
                  {col.label}
                  <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.color}`}>
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => openCreate(col.id)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1">
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={e => onDragOverTask(e, task.id)}
                    onClick={() => openEdit(task)}
                    className={`group relative bg-background border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all select-none ${dragId === task.id ? "opacity-40 shadow-lg ring-2 ring-primary/30" : ""}`}
                  >
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-sm font-medium leading-snug pr-5">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${PRIORITY_STYLES[task.priority].badge}`}>
                        {PRIORITY_STYLES[task.priority].label}
                      </span>
                      {task.tag && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                          <Tag className="w-2.5 h-2.5" />{task.tag}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg p-4 min-h-[80px]">
                    Solte aqui ou clique em +
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask?.id ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Descreva a tarefa..."
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes opcionais..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tag</Label>
                <Input
                  value={form.tag}
                  onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="Ex: Fiscal, IR..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editTask?.id && (
              <Button variant="destructive" size="sm" onClick={() => handleDelete(editTask.id)} className="mr-auto gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {editTask?.id ? "Salvar" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
