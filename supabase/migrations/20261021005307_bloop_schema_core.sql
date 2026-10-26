-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  banner_url text,
  bio text DEFAULT '',
  status text DEFAULT '',
  availability text DEFAULT 'online' CHECK (availability IN ('online','idle','dnd','offline')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- COMMUNITIES
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon_url text,
  banner_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rules text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- COMMUNITY MEMBERS
CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','moderator','member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (community_id, user_id)
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- CHANNELS
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  is_private boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to uuid REFERENCES messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- COMMUNITIES policies
DROP POLICY IF EXISTS "communities_select" ON communities;
CREATE POLICY "communities_select" ON communities FOR SELECT
  TO authenticated USING (
    visibility = 'public'
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "communities_insert" ON communities;
CREATE POLICY "communities_insert" ON communities FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "communities_update" ON communities;
CREATE POLICY "communities_update" ON communities FOR UPDATE
  TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin'))
  ) WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = communities.id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "communities_delete" ON communities;
CREATE POLICY "communities_delete" ON communities FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- COMMUNITY MEMBERS policies
DROP POLICY IF EXISTS "cm_select" ON community_members;
CREATE POLICY "cm_select" ON community_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM communities c WHERE c.id = community_members.community_id
      AND (c.visibility = 'public' OR c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM community_members cm2 WHERE cm2.community_id = c.id AND cm2.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "cm_insert_self_public" ON community_members;
CREATE POLICY "cm_insert_self_public" ON community_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.visibility = 'public')
  );

DROP POLICY IF EXISTS "cm_insert_admin" ON community_members;
CREATE POLICY "cm_insert_admin" ON community_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin','moderator')
    )
  );

DROP POLICY IF EXISTS "cm_update_role" ON community_members;
CREATE POLICY "cm_update_role" ON community_members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "cm_delete_self" ON community_members;
CREATE POLICY "cm_delete_self" ON community_members FOR DELETE
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cm_delete_admin" ON community_members;
CREATE POLICY "cm_delete_admin" ON community_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_members.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

-- CATEGORIES policies
DROP POLICY IF EXISTS "cat_select" ON categories;
CREATE POLICY "cat_select" ON categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = categories.community_id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "cat_write" ON categories;
CREATE POLICY "cat_write" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = categories.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

DROP POLICY IF EXISTS "cat_update" ON categories;
CREATE POLICY "cat_update" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = categories.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = categories.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

DROP POLICY IF EXISTS "cat_delete" ON categories;
CREATE POLICY "cat_delete" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = categories.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

-- CHANNELS policies
DROP POLICY IF EXISTS "channels_select" ON channels;
CREATE POLICY "channels_select" ON channels FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = channels.community_id AND cm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "channels_write" ON channels;
CREATE POLICY "channels_write" ON channels FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

DROP POLICY IF EXISTS "channels_update" ON channels;
CREATE POLICY "channels_update" ON channels FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

DROP POLICY IF EXISTS "channels_delete" ON channels;
CREATE POLICY "channels_delete" ON channels FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = channels.community_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin','moderator'))
  );

-- MESSAGES policies
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM channels ch
      JOIN community_members cm ON cm.community_id = ch.community_id
      WHERE ch.id = messages.channel_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM channels ch
      JOIN community_members cm ON cm.community_id = ch.community_id
      WHERE ch.id = messages.channel_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  TO authenticated USING (author_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_mod" ON messages;
CREATE POLICY "messages_delete_mod" ON messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM channels ch
      JOIN community_members cm ON cm.community_id = ch.community_id
      WHERE ch.id = messages.channel_id AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin','moderator')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_channels_community ON channels(community_id);
CREATE INDEX IF NOT EXISTS idx_categories_community ON categories(community_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS communities_updated_at ON communities;
CREATE TRIGGER communities_updated_at BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
