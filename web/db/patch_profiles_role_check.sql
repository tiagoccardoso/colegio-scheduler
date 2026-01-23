-- Patch: libera o papel 'pedagogical' em public.profiles.role
-- Corrige o erro:
--   new row for relation "profiles" violates check constraint "profiles_role_check"
--
-- Como aplicar:
--   Rode este script no Supabase (SQL Editor).
--
-- Observação importante:
--   O erro "syntax error at or near alter" pode acontecer quando o script usa
--   $$...$$ dentro de outro bloco DO $$...$$ (conflito de delimitadores).
--   Este arquivo evita esse problema usando tags diferentes ($do$, $ddl$).

DO $do$
DECLARE
  role_typ regtype;
  role_oid oid;
  is_enum boolean := false;
  existing_def text;
  roles text[];
  roles_sql text;
BEGIN
  -- Descobre o tipo da coluna public.profiles.role
  SELECT a.atttypid::regtype, a.atttypid
    INTO role_typ, role_oid
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attname = 'role'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF role_typ IS NULL THEN
    RAISE NOTICE 'Coluna public.profiles.role não encontrada. Nada a fazer.';
    RETURN;
  END IF;

  -- Se o tipo da coluna é ENUM
  SELECT EXISTS(
    SELECT 1
    FROM pg_type t
    WHERE t.oid = role_oid
      AND t.typtype = 'e'
  ) INTO is_enum;

  IF is_enum THEN
    -- role é ENUM: tenta adicionar o valor (se já existir, não faz nada)
    BEGIN
      EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', role_typ::text, 'pedagogical');
      RAISE NOTICE 'ENUM % atualizado com valor pedagogical.', role_typ::text;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Não foi possível alterar o ENUM % (%). Verifique manualmente.', role_typ::text, SQLERRM;
    END;

  ELSE
    -- role é TEXT/VARCHAR/etc com CHECK constraint.
    -- Tentamos preservar a lista atual de papéis e apenas acrescentar "pedagogical".

    SELECT pg_get_constraintdef(con.oid)
      INTO existing_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.conname = 'profiles_role_check';

    IF existing_def IS NOT NULL THEN
      SELECT array_agg(DISTINCT r)
        INTO roles
      FROM (
        SELECT (regexp_matches(existing_def, '''([^'']+)''::[a-zA-Z_ ]+', 'g'))[1] AS r
      ) s;
    END IF;

    IF roles IS NULL OR array_length(roles, 1) IS NULL THEN
      -- fallback seguro
      roles := ARRAY['director','teacher'];
    END IF;

    IF NOT ('pedagogical' = ANY(roles)) THEN
      roles := array_append(roles, 'pedagogical');
    END IF;

    -- Monta ARRAY['a'::text,'b'::text,...] como SQL
    SELECT string_agg(quote_literal(x) || '::text', ',')
      INTO roles_sql
    FROM unnest(roles) AS x;

    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check';

    EXECUTE format(
      'ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY[%s]))',
      roles_sql
    );

    RAISE NOTICE 'Constraint profiles_role_check atualizada. Roles permitidos agora: %', array_to_string(roles, ', ');
  END IF;
END
$do$;
