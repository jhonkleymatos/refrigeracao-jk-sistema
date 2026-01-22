-- CORREÇÃO DE ERRO: Infinite Recursion (Recursão Infinita)
-- Este script corrige o erro de permissão que impede o carregamento dos dados.

-- 1. Criar uma função segura para verificar se é admin
-- "Security Definer" permite checar a tabela sem ativar as regras de bloqueio (evita o loop)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- 2. Remover políticas antigas que causavam o erro
drop policy if exists "Admins veem todos os perfis" on public.profiles;
drop policy if exists "Clientes veem seus proprios servicos" on public.servicos;

-- 3. Criar novas políticas usando a função segura

-- REGRAS PARA PERFIS
create policy "Admins veem todos os perfis" on public.profiles
    for select using ( public.is_admin() );

-- REGRAS PARA SERVIÇOS
create policy "Ver servicos (Dono ou Admin)" on public.servicos
    for select using (
        cliente_profile_id = auth.uid() -- Dono do serviço
        or 
        public.is_admin() -- Admin vê todos
    );

-- Nota: Certifique-se também que o usuário tem acesso ao INSERT na tabela serviços
drop policy if exists "Clientes podem solicitar serviços" on public.servicos;
create policy "Clientes podem solicitar serviços" on public.servicos
    for insert with check (
        auth.role() = 'authenticated'
    );
