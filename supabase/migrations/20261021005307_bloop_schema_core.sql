CREATE OR REPLACE FUNCTION public.bloop_is_member(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.community_id = p_community_id
      AND cm.user_id = p_user_id
  );
$$;

-- Comprobar roles sin provocar recursión.
CREATE OR REPLACE FUNCTION public.bloop_has_role(
  p_community_id uuid,
  p_user_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.community_id = p_community_id
      AND cm.user_id = p_user_id
      AND cm.role = ANY(p_roles)
  );
$$;

-- Limitar el acceso a las funciones.
REVOKE ALL ON FUNCTION public.bloop_is_member(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bloop_has_role(uuid, uuid, text[])
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bloop_is_member(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bloop_has_role(uuid, uuid, text[])
  TO authenticated;

-- Corregir las políticas de comunidades.
DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select"
ON public.communities FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR owner_id = (SELECT auth.uid())
  OR public.bloop_is_member(id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "communities_update" ON public.communities;
CREATE POLICY "communities_update"
ON public.communities FOR UPDATE TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.bloop_has_role(
    id, (SELECT auth.uid()), ARRAY['owner','admin']::text[]
  )
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
  OR public.bloop_has_role(
    id, (SELECT auth.uid()), ARRAY['owner','admin']::text[]
  )
);

-- Corregir las políticas de miembros.
DROP POLICY IF EXISTS "cm_select" ON public.community_members;
CREATE POLICY "cm_select"
ON public.community_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.communities c
    WHERE c.id = community_members.community_id
      AND (
        c.visibility = 'public'
        OR c.owner_id = (SELECT auth.uid())
        OR public.bloop_is_member(c.id, (SELECT auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "cm_insert_admin" ON public.community_members;
CREATE POLICY "cm_insert_admin"
ON public.community_members FOR INSERT TO authenticated
WITH CHECK (
  public.bloop_has_role(
    community_id,
    (SELECT auth.uid()),
    ARRAY['owner','admin','moderator']::text[]
  )
);

DROP POLICY IF EXISTS "cm_update_role" ON public.community_members;
CREATE POLICY "cm_update_role"
ON public.community_members FOR UPDATE TO authenticated
USING (
  public.bloop_has_role(
    community_id,
    (SELECT auth.uid()),
    ARRAY['owner','admin']::text[]
  )
)
WITH CHECK (
  public.bloop_has_role(
    community_id,
    (SELECT auth.uid()),
    ARRAY['owner','admin']::text[]
  )
);

DROP POLICY IF EXISTS "cm_delete_admin" ON public.community_members;
CREATE POLICY "cm_delete_admin"
ON public.community_members FOR DELETE TO authenticated
USING (
  public.bloop_has_role(
    community_id,
    (SELECT auth.uid()),
    ARRAY['owner','admin','moderator']::text[]
  )
);
