-- ATUALIZAR TIPOS DE SERVIÇOS PERMITIDOS
-- Este script corrige o erro: violates check constraint "servicos_tipo_check"

-- 1. Remover a restrição antiga que limita os tipos
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_tipo_check;

-- 2. Recriar a restrição aceitando 'Portfólio' e 'Outro'
ALTER TABLE public.servicos ADD CONSTRAINT servicos_tipo_check 
  CHECK (tipo IN ('Instalação', 'Higienização', 'Manutenção', 'Portfólio', 'Outro'));

-- Mensagem de sucesso (opcional, para logs)
COMMENT ON CONSTRAINT servicos_tipo_check ON public.servicos IS 'Permite tipos: Instalação, Higienização, Manutenção, Portfólio, Outro';
