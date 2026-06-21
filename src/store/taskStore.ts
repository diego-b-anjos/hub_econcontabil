import { create } from "zustand";

export type Priority = "baixa" | "media" | "alta";
export type ColumnId = "todo" | "doing" | "review" | "done";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface SubTask {
  id: string;
  title: string;
  done: boolean;
  children: SubTask[]; // max 3 levels enforced by UI
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  tag?: string;
  column: ColumnId;
  createdAt: string;
  dueDate?: string;      // YYYY-MM-DD
  recurrence: Recurrence;
  subtasks: SubTask[];
}

const STORAGE_KEY = "econ:tasks:v2";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function togglePath(subtasks: SubTask[], path: string[]): SubTask[] {
  const [head, ...tail] = path;
  return subtasks.map((st) => {
    if (st.id !== head) return st;
    if (tail.length === 0) return { ...st, done: !st.done };
    return { ...st, children: togglePath(st.children, tail) };
  });
}

function addAtPath(subtasks: SubTask[], parentPath: string[], item: SubTask): SubTask[] {
  if (parentPath.length === 0) return [...subtasks, item];
  const [head, ...tail] = parentPath;
  return subtasks.map((st) => {
    if (st.id !== head) return st;
    return { ...st, children: addAtPath(st.children, tail, item) };
  });
}

function deleteAtPath(subtasks: SubTask[], path: string[]): SubTask[] {
  const [head, ...tail] = path;
  if (tail.length === 0) return subtasks.filter((st) => st.id !== head);
  return subtasks.map((st) => {
    if (st.id !== head) return st;
    return { ...st, children: deleteAtPath(st.children, tail) };
  });
}

function countSubtasks(subtasks: SubTask[]): { total: number; done: number } {
  let total = 0, done = 0;
  for (const st of subtasks) {
    total++;
    if (st.done) done++;
    const c = countSubtasks(st.children);
    total += c.total;
    done += c.done;
  }
  return { total, done };
}

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
    {
      id: uid(), title: "Revisar declarações de IR", description: "Conferir todas as declarações pendentes do mês.",
      priority: "alta", tag: "Fiscal", column: "todo", createdAt: new Date().toISOString(),
      recurrence: "none", subtasks: [],
      dueDate: new Date().toISOString().slice(0, 10),
    },
    {
      id: uid(), title: "Atualizar cadastro de clientes",
      priority: "media", tag: "Cadastro", column: "doing", createdAt: new Date().toISOString(),
      recurrence: "weekly", subtasks: [
        { id: uid(), title: "Verificar dados cadastrais", done: true, children: [] },
        { id: uid(), title: "Atualizar regime tributário", done: false, children: [
          { id: uid(), title: "Simples Nacional", done: false, children: [] },
          { id: uid(), title: "Lucro Presumido", done: false, children: [] },
        ]},
      ],
    },
    {
      id: uid(), title: "Gerar relatório trimestral",
      priority: "baixa", tag: "Relatório", column: "done", createdAt: new Date().toISOString(),
      recurrence: "none", subtasks: [],
    },
  ];
}

interface TaskStore {
  tasks: Task[];
  addTask: (data: Omit<Task, "id" | "createdAt">) => Task;
  updateTask: (id: string, data: Partial<Omit<Task, "id" | "createdAt">>) => void;
  deleteTask: (id: string) => void;
  setTasks: (tasks: Task[]) => void;
  toggleSubtask: (taskId: string, path: string[]) => void;
  addSubtask: (taskId: string, title: string, parentPath: string[]) => void;
  deleteSubtask: (taskId: string, path: string[]) => void;
  replicateRecurring: (taskId: string, dates: string[]) => void;
}

function save(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: loadTasks(),

  addTask: (data) => {
    const task: Task = { id: uid(), createdAt: new Date().toISOString(), ...data };
    const tasks = [...get().tasks, task];
    set({ tasks });
    save(tasks);
    return task;
  },

  updateTask: (id, data) => {
    const tasks = get().tasks.map((t) => (t.id === id ? { ...t, ...data } : t));
    set({ tasks });
    save(tasks);
  },

  deleteTask: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    set({ tasks });
    save(tasks);
  },

  setTasks: (tasks) => {
    set({ tasks });
    save(tasks);
  },

  toggleSubtask: (taskId, path) => {
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: togglePath(t.subtasks, path) } : t
    );
    set({ tasks });
    save(tasks);
  },

  addSubtask: (taskId, title, parentPath) => {
    const item: SubTask = { id: uid(), title, done: false, children: [] };
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: addAtPath(t.subtasks, parentPath, item) } : t
    );
    set({ tasks });
    save(tasks);
  },

  deleteSubtask: (taskId, path) => {
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, subtasks: deleteAtPath(t.subtasks, path) } : t
    );
    set({ tasks });
    save(tasks);
  },

  replicateRecurring: (taskId, dates) => {
    const base = get().tasks.find((t) => t.id === taskId);
    if (!base) return;
    const copies: Task[] = dates.map((dueDate) => ({
      ...base,
      id: uid(),
      createdAt: new Date().toISOString(),
      dueDate,
      subtasks: base.subtasks.map((st) => ({ ...st, done: false, children: st.children.map((c) => ({ ...c, done: false, children: c.children.map((g) => ({ ...g, done: false })) })) })),
    }));
    const tasks = [...get().tasks, ...copies];
    set({ tasks });
    save(tasks);
  },
}));

export { countSubtasks };
