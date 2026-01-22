-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tabela de Clientes
create table public.clientes (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  nome text not null,
  whatsapp text,
  endereco text,
  user_id uuid references auth.users(id) -- Opcional: para vincular ao usuário logado
);

-- 2. Tabela de Aparelhos
create table public.aparelhos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  marca text not null,
  modelo text,
  btus integer,
  tipo text check (tipo in ('split', 'janela', 'cassete', 'piso_teto', 'outro')) not null
);

-- 3. Tabela de Serviços
create table public.servicos (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  aparelho_id uuid references public.aparelhos(id) on delete cascade not null,
  tipo text check (tipo in ('Instalação', 'Higienização', 'Manutenção')) not null,
  data_execucao date default current_date,
  checklist jsonb default '{}'::jsonb, -- Ex: {"limpeza_filtro": true, "gas": "ok"}
  observacoes text,
  valor numeric(10,2)
);

-- 4. Tabela de Fotos do Serviço
create table public.fotos_servico (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  servico_id uuid references public.servicos(id) on delete cascade not null,
  url_foto text not null,
  nome_arquivo text not null
);

-- 5. Row Level Security (RLS)
-- Habilitar RLS
alter table public.clientes enable row level security;
alter table public.aparelhos enable row level security;
alter table public.servicos enable row level security;
alter table public.fotos_servico enable row level security;

-- Políticas de Acesso
-- Leitura pública para fotos (para a Galeria)
create policy "Fotos são públicas" on public.fotos_servico
  for select using (true);

-- Acesso total para usuários autenticados (Técnicos)
create policy "Acesso total a clientes para autenticados" on public.clientes
  for all using (auth.role() = 'authenticated');

create policy "Acesso total a aparelhos para autenticados" on public.aparelhos
  for all using (auth.role() = 'authenticated');

create policy "Acesso total a servicos para autenticados" on public.servicos
  for all using (auth.role() = 'authenticated');

create policy "Upload de fotos para autenticados" on public.fotos_servico
  for insert with check (auth.role() = 'authenticated');

create policy "Gerenciar fotos para autenticados" on public.fotos_servico
  for all using (auth.role() = 'authenticated');

-- 6. Storage Bucket
-- Nota: Você precisa criar o bucket 'servicos-fotos' no painel do Supabase Storage manualmente ou via API se tiver permissão.
-- As políticas de storage abaixo assumem que o bucket existe.

-- Política de Storage (SQL para Storage é criado em tabela storage.objects, mas geralmente configurado via UI)
-- Exemplo de inserção de política via SQL (pode variar dependendo da versão do Supabase)
-- insert into storage.buckets (id, name, public) values ('servicos-fotos', 'servicos-fotos', true);

-- create policy "Fotos públicas" on storage.objects for select using ( bucket_id = 'servicos-fotos' );
-- create policy "Upload autenticado" on storage.objects for insert with check ( bucket_id = 'servicos-fotos' and auth.role() = 'authenticated' );
