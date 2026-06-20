-- ============================================================
-- ECON Hub — Schema Completo (projeto novo)
-- Rodar no Supabase SQL Editor
-- ============================================================

-- ─── 1. Tabela clients ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text        NOT NULL,
  nome_fantasia             text,
  cnpj                      text,
  inscricao_estadual        text,
  inscricao_municipal       text,
  tax_regime                text,
  natureza_juridica         text,
  porte                     text,
  data_abertura             text,
  situacao_cadastral        text,
  capital_social            text,
  activity                  text,
  cnae_principal_codigo     text,
  cnae_principal_descricao  text,
  cnaes_secundarios         jsonb,
  cep                       text,
  logradouro                text,
  numero                    text,
  complemento               text,
  bairro                    text,
  municipio                 text,
  uf                        text,
  address                   text,
  telefone                  text,
  telefone_secundario       text,
  email                     text,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Tabela contadores ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contadores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  crc           text        NOT NULL,
  crc_uf        text,
  oab           text,
  email         text,
  telefone      text,
  especialidade text,
  archived      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Tabela profiles (usuários) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  full_name    text,
  role         text        NOT NULL DEFAULT 'user',
  contador_id  uuid        REFERENCES public.contadores(id) ON DELETE SET NULL,
  archived     boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Tabela simulations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.simulations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  name             text        NOT NULL,
  year             integer     NOT NULL,
  sn_annex         text        NOT NULL DEFAULT 'III',
  presumption_rate text        NOT NULL DEFAULT '0',
  iss_rate         text        NOT NULL DEFAULT '0',
  data             jsonb,
  result           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. RLS — habilitar ──────────────────────────────────────
ALTER TABLE public.clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contadores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- ─── 6. Políticas RLS — acesso total para usuários autenticados ──
CREATE POLICY "clients_all"
  ON public.clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "contadores_all"
  ON public.contadores FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "profiles_all"
  ON public.profiles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "simulations_all"
  ON public.simulations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── 7. Função updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER t_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_contadores_updated_at
  BEFORE UPDATE ON public.contadores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER t_simulations_updated_at
  BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 8. Criar profile automaticamente ao registrar usuário ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, archived)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user',
    false
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
