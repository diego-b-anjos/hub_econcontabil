/**
 * Banco de dados local via localStorage.
 * Simula as mesmas respostas da API REST, permitindo operações CRUD
 * totalmente offline no browser, sem backend.
 */

function now() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

function load<T>(key: string, defaults: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaults;
  } catch {
    return defaults;
  }
}

function save<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota exceeded — ignora
  }
}

// ─── CLIENTS ────────────────────────────────────────────────────────────────

const CLIENTS_KEY = "econ_db_clients";

export const localClients = {
  list: (): import("./api").Client[] => load(CLIENTS_KEY, []),

  count: () => ({ count: load<unknown>(CLIENTS_KEY, []).length }),

  create: (body: Omit<import("./api").Client, "id" | "createdAt" | "updatedAt">): import("./api").Client => {
    const items = load<import("./api").Client>(CLIENTS_KEY, []);
    const novo: import("./api").Client = { ...body, id: uuid(), createdAt: now(), updatedAt: now() };
    save(CLIENTS_KEY, [...items, novo]);
    return novo;
  },

  update: (id: string, body: Partial<Omit<import("./api").Client, "id" | "createdAt" | "updatedAt">>): import("./api").Client => {
    const items = load<import("./api").Client>(CLIENTS_KEY, []);
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cliente não encontrado");
    const updated = { ...items[idx], ...body, updatedAt: now() };
    items[idx] = updated;
    save(CLIENTS_KEY, items);
    return updated;
  },

  remove: (id: string): void => {
    const items = load<import("./api").Client>(CLIENTS_KEY, []).filter((c) => c.id !== id);
    save(CLIENTS_KEY, items);
  },
};

// ─── SIMULATIONS ────────────────────────────────────────────────────────────

const SIMS_KEY = "econ_db_simulations";

export const localSimulations = {
  list: (): import("./api").Simulation[] => {
    const clients = load<import("./api").Client>(CLIENTS_KEY, []);
    const sims = load<import("./api").Simulation>(SIMS_KEY, []);
    return sims.map((s) => ({
      ...s,
      clients: clients.find((c) => c.id === s.clientId) ? { name: clients.find((c) => c.id === s.clientId)!.name } : null,
    }));
  },

  count: () => ({ count: load<unknown>(SIMS_KEY, []).length }),

  get: (id: string): import("./api").Simulation => {
    const sims = load<import("./api").Simulation>(SIMS_KEY, []);
    const found = sims.find((s) => s.id === id);
    if (!found) throw new Error("Simulação não encontrada");
    return found;
  },

  create: (body: import("./api").SimulationPayload): { id: string } => {
    const items = load<import("./api").Simulation>(SIMS_KEY, []);
    const novo: import("./api").Simulation = {
      id: uuid(),
      clientId: body.client_id ?? null,
      name: body.name,
      year: body.year,
      snAnnex: body.sn_annex,
      presumptionRate: String(body.presumption_rate),
      issRate: String(body.iss_rate),
      data: body.data ?? null,
      result: body.result ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    save(SIMS_KEY, [...items, novo]);
    return { id: novo.id };
  },

  update: (id: string, body: Partial<import("./api").SimulationPayload>): void => {
    const items = load<import("./api").Simulation>(SIMS_KEY, []);
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Simulação não encontrada");
    if (body.name !== undefined) items[idx].name = body.name;
    if (body.year !== undefined) items[idx].year = body.year;
    if (body.sn_annex !== undefined) items[idx].snAnnex = body.sn_annex;
    if (body.presumption_rate !== undefined) items[idx].presumptionRate = String(body.presumption_rate);
    if (body.iss_rate !== undefined) items[idx].issRate = String(body.iss_rate);
    if (body.data !== undefined) items[idx].data = body.data;
    if (body.result !== undefined) items[idx].result = body.result;
    if (body.client_id !== undefined) items[idx].clientId = body.client_id ?? null;
    items[idx].updatedAt = now();
    save(SIMS_KEY, items);
  },

  remove: (id: string): void => {
    save(SIMS_KEY, load<import("./api").Simulation>(SIMS_KEY, []).filter((s) => s.id !== id));
  },
};

// ─── CONTADORES ─────────────────────────────────────────────────────────────

const CONTADORES_KEY = "econ_db_contadores";

export const localContadores = {
  list: (): import("./api").Contador[] => load(CONTADORES_KEY, []),

  create: (body: Omit<import("./api").Contador, "id" | "createdAt" | "updatedAt">): import("./api").Contador => {
    const items = load<import("./api").Contador>(CONTADORES_KEY, []);
    const novo: import("./api").Contador = { ...body, id: uuid(), archived: body.archived ?? false, createdAt: now(), updatedAt: now() };
    save(CONTADORES_KEY, [...items, novo]);
    return novo;
  },

  update: (id: string, body: Partial<Omit<import("./api").Contador, "id" | "createdAt" | "updatedAt">>): import("./api").Contador => {
    const items = load<import("./api").Contador>(CONTADORES_KEY, []);
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Contador não encontrado");
    items[idx] = { ...items[idx], ...body, updatedAt: now() };
    save(CONTADORES_KEY, items);
    return items[idx];
  },

  remove: (id: string): void => {
    save(CONTADORES_KEY, load<import("./api").Contador>(CONTADORES_KEY, []).filter((c) => c.id !== id));
  },
};

// ─── USERS ──────────────────────────────────────────────────────────────────

const USERS_KEY = "econ_db_users";

export const localUsers = {
  list: (): import("./api").User[] => load(USERS_KEY, []),

  me: (email: string): import("./api").MePayload => {
    const users = load<import("./api").User>(USERS_KEY, []);
    const contadores = load<import("./api").Contador>(CONTADORES_KEY, []);
    const user = users.find((u) => u.email === email);
    if (!user) throw new Error("Usuário não encontrado");
    const contador = user.contadorId ? (contadores.find((c) => c.id === user.contadorId) ?? null) : null;
    return { user, contador };
  },

  create: (body: import("./api").UserCreateInput): import("./api").User => {
    const items = load<import("./api").User>(USERS_KEY, []);
    const novo: import("./api").User = {
      id: uuid(),
      email: body.email,
      name: body.name,
      role: body.role,
      contadorId: body.contadorId ?? null,
      archived: body.archived ?? false,
      createdAt: now(),
      updatedAt: now(),
    };
    save(USERS_KEY, [...items, novo]);
    return novo;
  },

  update: (id: string, body: import("./api").UserUpdateInput): import("./api").User => {
    const items = load<import("./api").User>(USERS_KEY, []);
    const idx = items.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("Usuário não encontrado");
    items[idx] = { ...items[idx], ...body, updatedAt: now() };
    save(USERS_KEY, items);
    return items[idx];
  },

  remove: (id: string): void => {
    save(USERS_KEY, load<import("./api").User>(USERS_KEY, []).filter((u) => u.id !== id));
  },
};
