-- ATUALIZAÇÃO DO BANCO DE DADOS - REFRIGERAÇÃO JK (Role-Based)

-- 1. Tabela de Perfis (Para distinguir Cliente vs Técnico)
create table public.profiles (
  id uuid references auth.users(id) primary key,
  email text,
  role text default 'client' check (role in ('client', 'admin')),
  nome text,
  telefone text, -- Importante para o WhatsApp
  endereco text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger para criar perfil automaticamente ao cadastrar usuário
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client'); -- Padrão é cliente. Admin você muda manualmente no banco.
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Atualizar Tabela de Serviços
-- Se a tabela já existir, rode os comandos 'alter table' separadamente.
-- Aqui é o script completo assumindo criação do zero ou robustez.

-- Adicionar colunas se não existirem
do $$ 
begin
    if not exists (select 1 from information_schema.columns where table_name='servicos' and column_name='status') then
        alter table public.servicos add column status text default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado'));
    end if;

    if not exists (select 1 from information_schema.columns where table_name='servicos' and column_name='cliente_profile_id') then
        alter table public.servicos add column cliente_profile_id uuid references public.profiles(id);
    end if;
end $$;


-- 3. Atualizar RLS Policies (CRÍTICO)

-- Habilitar RLS em profiles
alter table public.profiles enable row level security;

-- Policies para Profiles
create policy "Usuários podem ver seu próprio perfil" on public.profiles
    for select using (auth.uid() = id);

create policy "Usuários podem atualizar seu próprio perfil" on public.profiles
    for update using (auth.uid() = id);

create policy "Admins veem todos os perfis" on public.profiles
    for select using (
        exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
    );

-- Policies para Serviços
-- Clientes só veem seus próprios serviços
create policy "Clientes veem seus proprios servicos" on public.servicos
    for select using (
        cliente_profile_id = auth.uid()
        or 
        exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' ) -- Admin vê tudo
    );

-- Clientes podem criar serviços (status pendente)
create policy "Clientes podem solicitar serviços" on public.servicos
    for insert with check (
        auth.role() = 'authenticated'
    );
