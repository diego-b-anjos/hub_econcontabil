
-- Tornar user_id opcional
ALTER TABLE public.clients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.simulations ALTER COLUMN user_id DROP NOT NULL;

-- Substituir políticas restritivas por acesso aberto (versão não oficial sem auth)
DROP POLICY IF EXISTS "own clients all" ON public.clients;
DROP POLICY IF EXISTS "own simulations all" ON public.simulations;

CREATE POLICY "public access clients"
  ON public.clients FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public access simulations"
  ON public.simulations FOR ALL
  USING (true)
  WITH CHECK (true);
