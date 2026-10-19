-- A credencial de runtime do Netlify DB (netlifydb_readonly) não é dona do
-- schema, então precisa de permissão explícita para gravar na tabela kv.
-- Sem isto, o painel admin recebe "permission denied for table kv".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'netlifydb_readonly') THEN
    GRANT USAGE ON SCHEMA public TO netlifydb_readonly;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE kv TO netlifydb_readonly;
  END IF;
END $$;
