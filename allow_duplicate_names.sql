-- PERMITIR NOMES DUPLICADOS NO CATÁLOGO
-- O usuário deseja adicionar serviços com o mesmo nome (mas descrições diferentes).

-- 1. Remover a restrição de "Nome Único"
ALTER TABLE public.service_catalog DROP CONSTRAINT IF EXISTS service_catalog_name_key;

-- Agora o banco aceitará nomes iguais.
