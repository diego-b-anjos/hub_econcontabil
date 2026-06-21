import { useState } from "react";
import {
  Plus, GripVertical, Tag, Trash2, ChevronRight, ChevronDown, ChevronLeft,
  RotateCcw, CalendarDays, CheckSquare, Square, Copy, Video, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useTaskStore, countSubtasks,
  type Task, type ColumnId, type Priority, type Recurrence, type SubTask,
} from "@/store/taskStore";

// ── Constantes ──────────────────────────────────────────────────────────────

const COLUMNS: { id: ColumnId; label: string; color: string; bg: string; dot: string }[] = [
  { id: "todo",   label: "A Fazer",      color: "text-zinc-500",   bg: "bg-zinc-100",   dot: "bg-zinc-400"   },
  { id: "doing",  label: "Em Andamento", color: "text-blue-600",   bg: "bg-blue-50",    dot: "bg-blue-500"   },
  { id: "review", label: "Em Revisão",   color: "text-yellow-600", bg: "bg-yellow-50",  dot: "bg-yellow-500" },
  { id: "done",   label: "Concluído",    color: "text-green-600",  bg: "bg-green-50",   dot: "bg-green-500"  },
];

const PRIORITY_MAP: Record<Priority, { label: string; cls: string }> = {
  baixa: { label: "Baixa", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  media: { label: "Média", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  alta:  { label: "Alta",  cls: "bg-red-100 text-red-600 border-red-200" },
};

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Esporádica", daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

const RECURRENCE_DAYS: Record<Recurrence, number> = { none: 0, daily: 1, weekly: 7, monthly: 30 };

// ── SubTask editor (3 níveis recursivo) ─────────────────────────────────────

function SubTaskItem({ sub, path, taskId, depth }: {
  sub: SubTask; path: string[]; taskId: string; depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const { toggleSubtask, addSubtask, deleteSubtask } = useTaskStore();
  const hasChildren = sub.children.length > 0;
  const canAddChildren = depth < 2; // 0-indexed → 3 levels max

  function commitAdd() {
    if (!newTitle.trim()) return;
    addSubtask(taskId, newTitle.trim(), path);
    setNewTitle(""); setAdding(false);
  }

  return (
    <div className={depth > 0 ? "ml-5 border-l border-border pl-3" : ""}>
      <div className="flex items-center gap-1.5 group py-0.5">
        <button
          onClick={() => hasChildren && setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground w-4"
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            : <span className="w-3 inline-block" />}
        </button>
        <button onClick={() => toggleSubtask(taskId, path)} className="shrink-0">
          {sub.done
            ? <CheckSquare className="w-4 h-4 text-green-600" />
            : <Square className="w-4 h-4 text-muted-foreground" />}
        </button>
        <span className={`flex-1 text-sm ${sub.done ? "line-through text-muted-foreground" : ""}`}>
          {sub.title}
        </span>
        {canAddChildren && (
          <button
            onClick={() => setAdding((v) => !v)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => deleteSubtask(taskId, path)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {adding && (
        <div className="ml-9 flex gap-1.5 mt-1">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Subtarefa..."
            className="h-7 text-xs"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={commitAdd}>OK</Button>
        </div>
      )}
      {expanded && sub.children.map((child) => (
        <SubTaskItem
          key={child.id} sub={child} path={[...path, child.id]}
          taskId={taskId} depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Card do Kanban ───────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, dragId, onDragStart, onDragEnd, onDragOverTask }: {
  task: Task;
  onEdit: (t: Task) => void;
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverTask: (e: React.DragEvent, id: string) => void;
}) {
  const { total, done } = countSubtasks(task.subtasks);
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.dueDate && task.dueDate < today && task.column !== "done";
  const isToday  = task.dueDate === today;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOverTask(e, task.id)}
      onClick={() => onEdit(task)}
      className={`group relative bg-background border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all select-none
        ${dragId === task.id ? "opacity-40 ring-2 ring-primary/30" : ""}
        ${isOverdue ? "border-red-200" : ""}
      `}
    >
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      <p className="text-sm font-medium leading-snug pr-5">{task.title}</p>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
      )}

      {task.dueDate && (
        <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium
          ${isOverdue ? "text-red-500" : isToday ? "text-orange-500" : "text-muted-foreground"}`}>
          <CalendarDays className="w-3 h-3" />
          {new Date(task.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          {isToday && " · Hoje"}
          {isOverdue && " · Atrasada"}
        </div>
      )}

      {total > 0 && (
        <div className="mt-1.5">
          <div className="text-[10px] text-muted-foreground mb-0.5">{done}/{total} subtarefas</div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${PRIORITY_MAP[task.priority].cls}`}>
          {PRIORITY_MAP[task.priority].label}
        </span>
        {task.recurrence !== "none" && (
          <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
            <RotateCcw className="w-2.5 h-2.5" /> {RECURRENCE_LABEL[task.recurrence]}
          </span>
        )}
        {task.tag && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            <Tag className="w-2.5 h-2.5" />{task.tag}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Dialog criar / editar ────────────────────────────────────────────────────

interface FormState {
  title: string; description: string; priority: Priority;
  tag: string; dueDate: string; recurrence: Recurrence; meetLink: string;
}

const EMPTY: FormState = {
  title: "", description: "", priority: "media", tag: "", dueDate: "", recurrence: "none", meetLink: "",
};

function TaskDialog({ task, defaultCol, onClose }: {
  task: Task | null; defaultCol: ColumnId; onClose: () => void;
}) {
  const { addTask, updateTask, deleteTask, addSubtask, replicateRecurring } = useTaskStore();
  const liveTask = useTaskStore((s) => s.tasks.find((t) => t.id === task?.id));

  const [form, setForm] = useState<FormState>(task ? {
    title: task.title, description: task.description ?? "",
    priority: task.priority, tag: task.tag ?? "",
    dueDate: task.dueDate ?? "", recurrence: task.recurrence,
    meetLink: task.meetLink ?? "",
  } : EMPTY);

  const [newSub, setNewSub] = useState("");
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateCount, setReplicateCount] = useState(4);

  function save() {
    if (!form.title.trim()) return;
    const data = { ...form, dueDate: form.dueDate || undefined, meetLink: form.meetLink || undefined };
    if (task) updateTask(task.id, data);
    else addTask({ ...data, column: defaultCol, subtasks: [] });
    onClose();
  }

  function remove() { if (task) { deleteTask(task.id); onClose(); } }

  function duplicate() {
    if (!task) return;
    addTask({
      title: `${form.title} (cópia)`,
      description: form.description || undefined,
      priority: form.priority,
      tag: form.tag || undefined,
      column: task.column,
      dueDate: form.dueDate || undefined,
      recurrence: form.recurrence,
      meetLink: form.meetLink || undefined,
      subtasks: [],
    });
    onClose();
  }

  function addTopSub() {
    if (!newSub.trim() || !task) return;
    addSubtask(task.id, newSub.trim(), []);
    setNewSub("");
  }

  function doReplicate() {
    if (!task) return;
    const base = new Date(form.dueDate || new Date().toISOString().slice(0, 10));
    const step = RECURRENCE_DAYS[form.recurrence] || 1;
    const dates: string[] = [];
    for (let i = 1; i <= replicateCount; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + step * i);
      dates.push(d.toISOString().slice(0, 10));
    }
    replicateRecurring(task.id, dates);
    setReplicateOpen(false);
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Descreva a tarefa..."
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes opcionais..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
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
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="Ex: Fiscal, IR..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Recorrência</Label>
              <Select value={form.recurrence} onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v as Recurrence }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Esporádica</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Replicar recorrência */}
          {task && form.recurrence !== "none" && form.dueDate && (
            <div className="rounded-lg border bg-blue-50 p-3 space-y-2">
              <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Tarefa recorrente — replicar cópias futuras
              </p>
              {replicateOpen ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Próximas</span>
                  <Input
                    type="number" value={replicateCount}
                    onChange={(e) => setReplicateCount(Number(e.target.value))}
                    className="h-7 w-16 text-xs" min={1} max={52}
                  />
                  <span className="text-xs text-muted-foreground">
                    {RECURRENCE_LABEL[form.recurrence].toLowerCase()}s
                  </span>
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={doReplicate}>Criar cópias</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReplicateOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setReplicateOpen(true)}>
                  <Copy className="w-3 h-3" /> Replicar para datas futuras
                </Button>
              )}
            </div>
          )}

          {/* Google Meet */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-blue-600" /> Reunião / Google Meet
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.meetLink}
                onChange={(e) => setForm((f) => ({ ...f, meetLink: e.target.value }))}
                placeholder="Cole o link da reunião..."
                className="h-8 text-xs flex-1"
              />
              {form.meetLink ? (
                <Button
                  size="sm" variant="outline" className="h-8 px-3 gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => window.open(form.meetLink, "_blank")}
                  type="button"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline" className="h-8 px-3 gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => window.open("https://meet.google.com/new", "_blank")}
                  type="button"
                >
                  <Video className="w-3.5 h-3.5" /> Criar reunião
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Cole o link do Meet ou clique em "Criar reunião" para abrir um novo.</p>
          </div>

          {/* Subtarefas — só em modo edição */}
          {task && (
            <div className="space-y-2">
              <Label>Subtarefas</Label>
              <div className="rounded-lg border bg-muted/30 p-2 space-y-1 max-h-52 overflow-y-auto">
                {(liveTask?.subtasks ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhuma subtarefa ainda</p>
                )}
                {(liveTask?.subtasks ?? []).map((sub) => (
                  <SubTaskItem key={sub.id} sub={sub} path={[sub.id]} taskId={task.id} depth={0} />
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTopSub(); }}
                  placeholder="Nova subtarefa..."
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8 px-3" onClick={addTopSub}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Clique em + dentro de uma subtarefa para criar sub-níveis (até 3 níveis)
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {task && (
            <>
              <Button variant="destructive" size="sm" onClick={remove} className="mr-auto gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
              <Button variant="outline" size="sm" onClick={duplicate} className="gap-1">
                <Copy className="w-3.5 h-3.5" /> Duplicar
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!form.title.trim()}>
            {task ? "Salvar" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Tarefas() {
  const { tasks, setTasks } = useTaskStore();
  const [dialogTask, setDialogTask] = useState<Task | null | "new">(null);
  const [defaultCol, setDefaultCol] = useState<ColumnId>("todo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);
  const [navDate, setNavDate] = useState<string | null>(new Date().toISOString().slice(0, 10));

  function openCreate(col: ColumnId = "todo") { setDefaultCol(col); setDialogTask("new"); }
  function openEdit(task: Task) { setDialogTask(task); }

  function shiftDate(delta: number) {
    const base = navDate ?? new Date().toISOString().slice(0, 10);
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setNavDate(d.toISOString().slice(0, 10));
  }

  function onDragOverTask(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;
    const reordered = [...tasks];
    const fi = reordered.findIndex((t) => t.id === dragId);
    const ti = reordered.findIndex((t) => t.id === overId);
    const [moved] = reordered.splice(fi, 1);
    reordered.splice(ti, 0, { ...moved, column: overTask.column });
    setTasks(reordered);
  }

  function onDropCol(col: ColumnId) {
    if (!dragId) return;
    setTasks(tasks.map((t) => (t.id === dragId ? { ...t, column: col } : t)));
    setDragId(null); setDragOverCol(null);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayCount  = tasks.filter((t) => t.dueDate === today && t.column !== "done").length;
  const overdueCount = tasks.filter((t) => t.dueDate && t.dueDate < today && t.column !== "done").length;

  // Filtragem por data de navegação
  const visibleTasks = navDate
    ? tasks.filter((t) => t.dueDate === navDate || (!t.dueDate && navDate === today))
    : tasks;

  const navLabel = navDate
    ? navDate === today
      ? "Hoje"
      : new Date(navDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    : "Todas";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quadro Kanban do escritório
            {todayCount > 0 && <span className="ml-2 text-orange-600 font-medium">· {todayCount} para hoje</span>}
            {overdueCount > 0 && <span className="ml-2 text-red-500 font-medium">· {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova tarefa
        </Button>
      </div>

      {/* Navegação diária */}
      <div className="flex items-center gap-2 bg-muted/40 border rounded-lg px-3 py-2 w-fit">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => shiftDate(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <button
          className="text-sm font-semibold min-w-[100px] text-center hover:text-primary transition-colors"
          onClick={() => setNavDate(today)}
          title="Ir para hoje"
        >
          {navLabel}
          {navDate === today && <span className="ml-1.5 text-[10px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full">hoje</span>}
        </button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => shiftDate(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {navDate && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setNavDate(null)}>
            Ver todas
          </Button>
        )}
        {navDate && (
          <span className="text-xs text-muted-foreground ml-1">
            {visibleTasks.length} tarefa{visibleTasks.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = visibleTasks.filter((t) => t.column === col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              className={`flex flex-col gap-3 rounded-xl p-3 border transition-colors min-h-[400px]
                ${isOver ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDropCol(col.id)}
            >
              <div className="flex items-center justify-between px-1">
                <div className={`flex items-center gap-2 font-semibold text-sm ${col.color}`}>
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  {col.label}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.color}`}>
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

              <div className="flex flex-col gap-2 flex-1">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id} task={task} onEdit={openEdit}
                    dragId={dragId}
                    onDragStart={setDragId}
                    onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                    onDragOverTask={onDragOverTask}
                  />
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

      {/* Dialog */}
      {dialogTask !== null && (
        <TaskDialog
          task={dialogTask === "new" ? null : dialogTask}
          defaultCol={defaultCol}
          onClose={() => setDialogTask(null)}
        />
      )}
    </div>
  );
}
