-- SCRIPT MESTRE DO BANCO DE DADOS - REFRIGERAÇÃO JK
-- Contém: Estrutura, Políticas de Segurança (RLS), Triggers e Catálogo Inicial.
-- Substitui todos os scripts anteriores.

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELAS DE DADOS

-- 2.1 PERFIS (Usuários) - Vinculado ao Auth do Supabase
create table if not exists public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  role text default 'client' check (role in ('client', 'admin')),
  nome text,
  telefone text,
  endereco text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.2 CLIENTES (Legado/Compatibilidade)
create table if not exists public.clientes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  whatsapp text,
  endereco text,
  user_id uuid references auth.users(id)
);

-- 2.3 APARELHOS
create table if not exists public.aparelhos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  marca text not null,
  modelo text,
  btus integer,
  tipo text check (tipo in ('split', 'janela', 'cassete', 'piso_teto', 'outro')) not null
);

-- 2.4 SERVIÇOS
create table if not exists public.servicos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  aparelho_id uuid references public.aparelhos(id) on delete cascade not null,
  cliente_profile_id uuid references public.profiles(id), -- Link direto opcional para profile
  tipo text not null,
  data_execucao date default current_date,
  checklist jsonb default '{}'::jsonb,
  observacoes text,
  valor numeric(10,2),
  status text default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado'))
);

-- 2.5 FOTOS DO SERVIÇO
create table if not exists public.fotos_servico (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  servico_id uuid references public.servicos(id) on delete cascade not null,
  url_foto text not null,
  nome_arquivo text not null
);

-- 2.6 CATÁLOGO DE SERVIÇOS
create table if not exists public.service_catalog (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique,
  description text,
  price numeric(10,2) not null default 0.00,
  active boolean default true
);

-- 3. TRIGGERS E FUNÇÕES

-- Auto-criação de perfil ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. ROW LEVEL SECURITY (RLS)

-- Habilitar RLS em tudo
alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.aparelhos enable row level security;
alter table public.servicos enable row level security;
alter table public.fotos_servico enable row level security;
alter table public.service_catalog enable row level security;

-- 4.1 POLÍTICAS: PROFILES
drop policy if exists "Ver próprio perfil" on public.profiles;
create policy "Ver próprio perfil" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Atualizar próprio perfil" on public.profiles;
create policy "Atualizar próprio perfil" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Admin ver tudo" on public.profiles;
create policy "Admin ver tudo" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 4.2 POLÍTICAS: CATÁLOGO
drop policy if exists "Leitura pública catalogo" on public.service_catalog;
create policy "Leitura pública catalogo" on public.service_catalog for select using (active = true);

drop policy if exists "Admin gerencia catalogo" on public.service_catalog;
create policy "Admin gerencia catalogo" on public.service_catalog for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 4.3 POLÍTICAS: FOTOS (Públicas)
drop policy if exists "Fotos Publicas View" on public.fotos_servico;
create policy "Fotos Publicas View" on public.fotos_servico for select using (true);

drop policy if exists "Admin Manage Fotos" on public.fotos_servico;
create policy "Admin Manage Fotos" on public.fotos_servico for all using (
  auth.uid() in (select id from public.profiles where role = 'admin')
);

-- 4.4 POLÍTICAS: APARELHOS
drop policy if exists "Public View Aparelhos" on public.aparelhos;
create policy "Public View Aparelhos" on public.aparelhos for select using (true); -- Necessário para galeria

drop policy if exists "Cliente Cria Aparelhos" on public.aparelhos;
create policy "Cliente Cria Aparelhos" on public.aparelhos for insert with check (auth.role() = 'authenticated');

drop policy if exists "Admin Manage Aparelhos" on public.aparelhos;
create policy "Admin Manage Aparelhos" on public.aparelhos for all using (
  auth.uid() in (select id from public.profiles where role = 'admin')
);

-- 4.5 POLÍTICAS: SERVIÇOS
drop policy if exists "View Services" on public.servicos;
create policy "View Services" on public.servicos for select using (
  cliente_profile_id = auth.uid() -- O próprio dono
  OR auth.uid() in (select user_id from public.clientes where id = (select cliente_id from public.aparelhos where id = aparelho_id)) -- Dono via clientes (legado)
  OR auth.uid() in (select id from public.profiles where role = 'admin') -- Admin
  OR status = 'concluido' -- Público pode ver concluídos (Galeria)
);

drop policy if exists "Cliente Solicita Servico" on public.servicos;
create policy "Cliente Solicita Servico" on public.servicos for insert with check (auth.role() = 'authenticated');

drop policy if exists "Admin Manage Servicos" on public.servicos;
create policy "Admin Manage Servicos" on public.servicos for all using (
  auth.uid() in (select id from public.profiles where role = 'admin')
);

-- 4.6 POLÍTICAS: CLIENTES (Legado)
drop policy if exists "Cliente vê a si mesmo" on public.clientes;
create policy "Cliente vê a si mesmo" on public.clientes for all using (user_id = auth.uid());

drop policy if exists "Admin vê clientes" on public.clientes;
create policy "Admin vê clientes" on public.clientes for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- 5. STORAGE (Bucket de Fotos)
insert into storage.buckets (id, name, public)
values ('servicos-fotos', 'servicos-fotos', true)
on conflict (id) do update set public = true;

-- Políticas de Storage
drop policy if exists "Public Select Storage" on storage.objects;
create policy "Public Select Storage" on storage.objects for select using (bucket_id = 'servicos-fotos');

drop policy if exists "Auth Upload Storage" on storage.objects;
create policy "Auth Upload Storage" on storage.objects for insert with check (
  bucket_id = 'servicos-fotos' and auth.role() = 'authenticated'
);

drop policy if exists "Admin Manage Storage" on storage.objects;
create policy "Admin Manage Storage" on storage.objects for all using (
  bucket_id = 'servicos-fotos' and auth.uid() in (select id from public.profiles where role = 'admin')
);

-- 6. SEED DATA (Dados Iniciais)
insert into public.service_catalog (name, description, price) values
('Instalação Split 9000/12000', 'Instalação completa com até 3m de tubulação', 450.00),
('Instalação Split 18000/24000', 'Instalação completa com até 3m de tubulação', 550.00),
('Higienização Simples', 'Limpeza de filtros e carenagem', 150.00),
('Higienização Completa', 'Desmontagem completa e limpeza química', 250.00),
('Manutenção / Visita Técnica', 'Diagnóstico de problemas (valor abatido se fechar serviço)', 80.00)
on conflict (name) do nothing;

-- 7. REFRESH SCHEMA CACHE (Para usuários anônimos)
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
