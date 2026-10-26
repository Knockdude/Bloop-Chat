
-- BLOOP: eliminar todas las políticas antiguas de miembros.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_members'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.community_members',
      p.policyname
    );
  END LOOP;
END $$;

-- Consultar membresías sin volver a activar el RLS de esa tabla.
CREATE OR REPLACE FUNCTION public.bloop_member_access(
  p_community_id uuid,
  p_user_id uuid,
  p_action text,
  p_role text DEFAULT 'member'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE p_action
    WHEN 'read' THEN
      EXISTS (
        SELECT 1
        FROM public.communities c
        WHERE c.id = p_community_id
          AND (
            c.visibility = 'public'
            OR c.owner_id = p_user_id
            OR EXISTS (
              SELECT 1
              FROM public.community_members m
              WHERE m.community_id = p_community_id
                AND m.user_id = p_user_id
            )
          )
      )
    WHEN 'insert' THEN
      EXISTS (
        SELECT 1
        FROM public.communities c
        WHERE c.id = p_community_id
          AND (
            (p_role = 'owner' AND c.owner_id = p_user_id)
            OR (
              p_role = 'member'
              AND c.visibility = 'public'
            )
            OR EXISTS (
              SELECT 1
              FROM public.community_members m
              WHERE m.community_id = p_community_id
                AND m.user_id = p_user_id
                AND m.role IN ('owner', 'admin', 'moderator')
            )
          )
      )
    WHEN 'manage' THEN
      EXISTS (
        SELECT 1
        FROM public.community_members m
        WHERE m.community_id = p_community_id
          AND m.user_id = p_user_id
          AND m.role IN ('owner', 'admin')
      )
    WHEN 'moderate' THEN
      EXISTS (
        SELECT 1
        FROM public.community_members m
        WHERE m.community_id = p_community_id
          AND m.user_id = p_user_id
          AND m.role IN ('owner', 'admin', 'moderator')
      )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION
  public.bloop_member_access(uuid, uuid, text, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.bloop_member_access(uuid, uuid, text, text)
  TO authenticated;

-- Leer miembros de comunidades públicas o accesibles.
CREATE POLICY "bloop_members_read"
ON public.community_members
FOR SELECT TO authenticated
USING (
  public.bloop_member_access(
    community_id, (SELECT auth.uid()), 'read'
  )
);

-- Crear la membresía propia: propietario o miembro público.
CREATE POLICY "bloop_members_insert"
ON public.community_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND public.bloop_member_access(
    community_id, (SELECT auth.uid()), 'insert', role
  )
);

-- Solo propietarios y administradores pueden cambiar membresías.
CREATE POLICY "bloop_members_update"
ON public.community_members
FOR UPDATE TO authenticated
USING (
  public.bloop_member_access(
    community_id, (SELECT auth.uid()), 'manage'
  )
)
WITH CHECK (
  public.bloop_member_access(
    community_id, (SELECT auth.uid()), 'manage'
  )
);

-- Moderadores y superiores pueden eliminar membresías.
CREATE POLICY "bloop_members_delete"
ON public.community_members
FOR DELETE TO authenticated
USING (
  public.bloop_member_access(
    community_id, (SELECT auth.uid()), 'moderate'
  )
);
