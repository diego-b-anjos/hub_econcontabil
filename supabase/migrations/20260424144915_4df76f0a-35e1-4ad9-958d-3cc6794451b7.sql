create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, company text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create table public.clients (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, cnpj text, activity text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.clients enable row level security;
create policy "own clients all" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.clients(user_id);

create table public.simulations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, client_id uuid references public.clients(id) on delete set null, name text not null, year int not null, sn_annex text not null default 'III', presumption_rate numeric not null default 0.32, iss_rate numeric not null default 0.05, data jsonb not null default '{}'::jsonb, result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.simulations enable row level security;
create policy "own simulations all" on public.simulations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.simulations(user_id);
create index on public.simulations(client_id);

create or replace function public.tg_set_updated_at() returns trigger language plpgsql as $func$ begin new.updated_at = now(); return new; end; $func$;
create trigger profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger clients_updated before update on public.clients for each row execute function public.tg_set_updated_at();
create trigger simulations_updated before update on public.simulations for each row execute function public.tg_set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $func$ begin insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end; $func$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();