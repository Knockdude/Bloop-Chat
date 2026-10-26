-- BLOOP: arregla solamente el flujo de creación de comunidades.
-- La función crea la comunidad, agrega al creador como owner y crea #general
-- en una única transacción, evitando que el flujo del cliente active las
-- políticas recursivas de community_members.

CREATE OR REPLACE FUNCTION public.create_community(
  p_name text,
  p_description text DEFAULT '',
  p_visibility text DEFAULT 'public'
)
RETURNS public.communities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_community public.communities;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para crear una comunidad.'
      USING ERRCODE = '28000';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'El nombre de la comunidad no puede estar vacío.'
      USING ERRCODE = '22023';
  END IF;

  IF p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'La visibilidad debe ser public o private.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.communities (name, description, visibility, owner_id)
  VALUES (p_name, COALESCE(p_description, ''), p_visibility, v_user_id)
  RETURNING * INTO v_community;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community.id, v_user_id, 'owner');

  INSERT INTO public.channels (community_id, name, description, position)
  VALUES (v_community.id, 'general', 'General conversation', 0);

  RETURN v_community;
END;
$$;

REVOKE ALL ON FUNCTION public.create_community(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_community(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_community(text, text, text) TO authenticated;
