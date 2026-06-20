/**
 * Camada de dados — usa Supabase como backend.
 * As interfaces e assinaturas são idênticas à versão localStorage,
 * permitindo que todos os componentes existentes funcionem sem alterações.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// ─── Interfaces públicas (inalteradas) ──────────────────────────────────────

export interface CnaeSecundario {
  codigo: string;
  descricao: string;
}

export interface Client {
  id: string;
  name: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  taxRegime: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  dataAbertura: string | null;
  situacaoCadastral: string | null;
  capitalSocial: string | null;
  activity: string | null;
  cnaePrincipalCodigo: string | null;
  cnaePrincipalDescricao: string | null;
  cnaesSecundarios: CnaeSecundario[] | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  address: string | null;
  telefone: string | null;
  telefoneSecundario: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Simulation {
  id: string;
  clientId: string | null;
  name: string;
  year: number;
  snAnnex: string;
  presumptionRate: string;
  issRate: string;
  data: unknown;
  result: unknown;
  createdAt: string;
  updatedAt: string;
  clients?: { name: string } | null;
}

export interface SimulationPayload {
  client_id?: string | null;
  name: string;
  year: number;
  sn_annex: string;
  presumption_rate: number;
  iss_rate: number;
  data?: unknown;
  result?: unknown;
}

export interface Contador {
  id: string;
  name: string;
  crc: string;
  crcUf: string | null;
  oab: string | null;
  email: string | null;
  telefone: string | null;
  especialidade: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  contadorId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateInput {
  email: string;
  name: string;
  role: string;
  contadorId?: string | null;
  archived?: boolean;
  passwordHash?: string | null;
}

export type UserUpdateInput = Partial<UserCreateInput>;

export interface MePayload {
  user: User;
  contador: Contador | null;
}

// ─── Helpers de mapeamento snake_case ↔ camelCase ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClient(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    nomeFantasia: row.nome_fantasia ?? null,
    cnpj: row.cnpj ?? null,
    inscricaoEstadual: row.inscricao_estadual ?? null,
    inscricaoMunicipal: row.inscricao_municipal ?? null,
    taxRegime: row.tax_regime ?? null,
    naturezaJuridica: row.natureza_juridica ?? null,
    porte: row.porte ?? null,
    dataAbertura: row.data_abertura ?? null,
    situacaoCadastral: row.situacao_cadastral ?? null,
    capitalSocial: row.capital_social ?? null,
    activity: row.activity ?? null,
    cnaePrincipalCodigo: row.cnae_principal_codigo ?? null,
    cnaePrincipalDescricao: row.cnae_principal_descricao ?? null,
    cnaesSecundarios: row.cnaes_secundarios
      ? (row.cnaes_secundarios as CnaeSecundario[])
      : null,
    cep: row.cep ?? null,
    logradouro: row.logradouro ?? null,
    numero: row.numero ?? null,
    complemento: row.complemento ?? null,
    bairro: row.bairro ?? null,
    municipio: row.municipio ?? null,
    uf: row.uf ?? null,
    address: row.address ?? null,
    telefone: row.telefone ?? null,
    telefoneSecundario: row.telefone_secundario ?? null,
    email: row.email ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromClient(
  body: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.name !== undefined) out.name = body.name;
  if (body.nomeFantasia !== undefined) out.nome_fantasia = body.nomeFantasia;
  if (body.cnpj !== undefined) out.cnpj = body.cnpj;
  if (body.inscricaoEstadual !== undefined) out.inscricao_estadual = body.inscricaoEstadual;
  if (body.inscricaoMunicipal !== undefined) out.inscricao_municipal = body.inscricaoMunicipal;
  if (body.taxRegime !== undefined) out.tax_regime = body.taxRegime;
  if (body.naturezaJuridica !== undefined) out.natureza_juridica = body.naturezaJuridica;
  if (body.porte !== undefined) out.porte = body.porte;
  if (body.dataAbertura !== undefined) out.data_abertura = body.dataAbertura;
  if (body.situacaoCadastral !== undefined) out.situacao_cadastral = body.situacaoCadastral;
  if (body.capitalSocial !== undefined) out.capital_social = body.capitalSocial;
  if (body.activity !== undefined) out.activity = body.activity;
  if (body.cnaePrincipalCodigo !== undefined) out.cnae_principal_codigo = body.cnaePrincipalCodigo;
  if (body.cnaePrincipalDescricao !== undefined) out.cnae_principal_descricao = body.cnaePrincipalDescricao;
  if (body.cnaesSecundarios !== undefined) out.cnaes_secundarios = body.cnaesSecundarios as Json;
  if (body.cep !== undefined) out.cep = body.cep;
  if (body.logradouro !== undefined) out.logradouro = body.logradouro;
  if (body.numero !== undefined) out.numero = body.numero;
  if (body.complemento !== undefined) out.complemento = body.complemento;
  if (body.bairro !== undefined) out.bairro = body.bairro;
  if (body.municipio !== undefined) out.municipio = body.municipio;
  if (body.uf !== undefined) out.uf = body.uf;
  if (body.address !== undefined) out.address = body.address;
  if (body.telefone !== undefined) out.telefone = body.telefone;
  if (body.telefoneSecundario !== undefined) out.telefone_secundario = body.telefoneSecundario;
  if (body.email !== undefined) out.email = body.email;
  if (body.notes !== undefined) out.notes = body.notes;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toContador(row: any): Contador {
  return {
    id: row.id,
    name: row.name,
    crc: row.crc,
    crcUf: row.crc_uf ?? null,
    oab: row.oab ?? null,
    email: row.email ?? null,
    telefone: row.telefone ?? null,
    especialidade: row.especialidade ?? null,
    archived: row.archived ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromContador(
  body: Partial<Omit<Contador, "id" | "createdAt" | "updatedAt">>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.name !== undefined) out.name = body.name;
  if (body.crc !== undefined) out.crc = body.crc;
  if (body.crcUf !== undefined) out.crc_uf = body.crcUf;
  if (body.oab !== undefined) out.oab = body.oab;
  if (body.email !== undefined) out.email = body.email;
  if (body.telefone !== undefined) out.telefone = body.telefone;
  if (body.especialidade !== undefined) out.especialidade = body.especialidade;
  if (body.archived !== undefined) out.archived = body.archived;
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(row: any): User {
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.full_name ?? row.email ?? "",
    role: row.role ?? "user",
    contadorId: row.contador_id ?? null,
    archived: row.archived ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromUser(body: Partial<UserCreateInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (body.email !== undefined) out.email = body.email;
  if (body.name !== undefined) out.full_name = body.name;
  if (body.role !== undefined) out.role = body.role;
  if (body.contadorId !== undefined) out.contador_id = body.contadorId;
  if (body.archived !== undefined) out.archived = body.archived;
  return out;
}

// ─── Helper para lançar erros do Supabase ────────────────────────────────────

function assertOk<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Registro não encontrado");
  return data;
}

// ─── API Clients ─────────────────────────────────────────────────────────────

export const apiClients = {
  list: async (): Promise<Client[]> => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name");
    assertOk(data, error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(toClient);
  },

  create: async (
    body: Omit<Client, "id" | "createdAt" | "updatedAt">
  ): Promise<Client> => {
    const { data, error } = await supabase
      .from("clients")
      .insert(fromClient(body))
      .select()
      .single();
    return toClient(assertOk(data, error));
  },

  update: async (
    id: string,
    body: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>
  ): Promise<Client> => {
    const { data, error } = await supabase
      .from("clients")
      .update(fromClient(body))
      .eq("id", id)
      .select()
      .single();
    return toClient(assertOk(data, error));
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  count: async (): Promise<{ count: number }> => {
    const { count, error } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  },
};

// ─── API Simulations ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSimulation(row: any): Simulation {
  return {
    id: row.id,
    clientId: row.client_id ?? null,
    name: row.name,
    year: row.year,
    snAnnex: row.sn_annex,
    presumptionRate: String(row.presumption_rate),
    issRate: String(row.iss_rate),
    data: row.data,
    result: row.result ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clients: row.clients ?? null,
  };
}

export const apiSimulations = {
  list: async (): Promise<Simulation[]> => {
    const { data, error } = await supabase
      .from("simulations")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });
    assertOk(data, error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(toSimulation);
  },

  get: async (id: string): Promise<Simulation> => {
    const { data, error } = await supabase
      .from("simulations")
      .select("*, clients(name)")
      .eq("id", id)
      .single();
    return toSimulation(assertOk(data, error));
  },

  create: async (body: SimulationPayload): Promise<{ id: string }> => {
    const { data, error } = await supabase
      .from("simulations")
      .insert({
        client_id: body.client_id ?? null,
        name: body.name,
        year: body.year,
        sn_annex: body.sn_annex,
        presumption_rate: body.presumption_rate,
        iss_rate: body.iss_rate,
        data: (body.data as Json) ?? {},
        result: (body.result as Json) ?? null,
      })
      .select("id")
      .single();
    const row = assertOk(data, error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { id: (row as any).id };
  },

  update: async (id: string, body: Partial<SimulationPayload>): Promise<void> => {
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.year !== undefined) patch.year = body.year;
    if (body.sn_annex !== undefined) patch.sn_annex = body.sn_annex;
    if (body.presumption_rate !== undefined) patch.presumption_rate = body.presumption_rate;
    if (body.iss_rate !== undefined) patch.iss_rate = body.iss_rate;
    if (body.data !== undefined) patch.data = body.data as Json;
    if (body.result !== undefined) patch.result = body.result as Json;
    if (body.client_id !== undefined) patch.client_id = body.client_id;

    const { error } = await supabase
      .from("simulations")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from("simulations").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  count: async (): Promise<{ count: number }> => {
    const { count, error } = await supabase
      .from("simulations")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  },
};

// ─── API Contadores ──────────────────────────────────────────────────────────

export const apiContadores = {
  list: async (): Promise<Contador[]> => {
    const { data, error } = await supabase
      .from("contadores")
      .select("*")
      .order("name");
    assertOk(data, error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(toContador);
  },

  create: async (
    body: Omit<Contador, "id" | "createdAt" | "updatedAt" | "archived"> & {
      archived?: boolean;
    }
  ): Promise<Contador> => {
    const { data, error } = await supabase
      .from("contadores")
      .insert(fromContador(body))
      .select()
      .single();
    return toContador(assertOk(data, error));
  },

  update: async (
    id: string,
    body: Partial<Omit<Contador, "id" | "createdAt" | "updatedAt">>
  ): Promise<Contador> => {
    const { data, error } = await supabase
      .from("contadores")
      .update(fromContador(body))
      .eq("id", id)
      .select()
      .single();
    return toContador(assertOk(data, error));
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from("contadores").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── API Users (tabela profiles) ─────────────────────────────────────────────

export const apiUsers = {
  list: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    assertOk(data, error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(toUser);
  },

  me: async (email: string): Promise<MePayload> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();
    const profileRow = assertOk(data, error);
    const user = toUser(profileRow);

    let contador: Contador | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((profileRow as any).contador_id) {
      const { data: cData } = await supabase
        .from("contadores")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("*")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("id", (profileRow as any).contador_id)
        .single();
      if (cData) contador = toContador(cData);
    }

    return { user, contador };
  },

  create: async (body: UserCreateInput): Promise<User> => {
    const { data, error } = await supabase
      .from("profiles")
      .insert(fromUser(body))
      .select()
      .single();
    return toUser(assertOk(data, error));
  },

  update: async (id: string, body: UserUpdateInput): Promise<User> => {
    const { data, error } = await supabase
      .from("profiles")
      .update(fromUser(body))
      .eq("id", id)
      .select()
      .single();
    return toUser(assertOk(data, error));
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
