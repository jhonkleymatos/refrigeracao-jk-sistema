-- REMOVER RESTRIÇÃO DE TIPOS DE SERVIÇO
-- Como agora você cria nomes de serviços personalizados (ex: "Instalação Split 30000"),
-- precisamos parar de limitar o banco a aceitar apenas os 3 nomes padrões.

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_tipo_check;

-- Agora a coluna 'tipo' aceitará qualquer texto que você cadastrar no catálogo.
