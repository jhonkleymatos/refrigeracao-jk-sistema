-- TABELA DE CATÁLOGO DE SERVIÇOS
-- Permite que o Admin gerencie preços e tipos de serviços dinamicamente.

-- 1. Criar Tabela
create table public.service_catalog (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique, -- Ex: 'Higienização Split 9000 BTUs'
  description text,
  price numeric(10,2) not null default 0.00,
  active boolean default true -- Se false, não aparece para o cliente
);

-- 2. Habilitar RLS
alter table public.service_catalog enable row level security;

-- 3. Políticas de Segurança

-- Todos (inclusive anônimos, se quiser mostrar no site público) podem Ler ativos
create policy "Leitura pública de serviços ativos" on public.service_catalog
  for select using (active = true);

-- Admins tem permissão total
create policy "Admins gerenciam catalogo" on public.service_catalog
  for all using (
    exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
  );

-- 4. Dados Iniciais (Seed)
insert into public.service_catalog (name, description, price) values
('Instalação Split 9000/12000', 'Instalação completa com até 3m de tubulação', 450.00),
('Instalação Split 18000/24000', 'Instalação completa com até 3m de tubulação', 550.00),
('Higienização Simples', 'Limpeza de filtros e carenagem', 150.00),
('Higienização Completa', 'Desmontagem completa e limpeza química', 250.00),
('Manutenção / Visita Técnica', 'Diagnóstico de problemas (valor abatido se fechar serviço)', 80.00)
on conflict (name) do nothing;
