/*
# BLOOP DM, reactions, notifications, preferences schema
Tables: direct_conversations, conversation_members, direct_messages,
message_reactions, notifications, user_blocks, user_preferences, read_states.
All with RLS and ownership-based policies. Realtime enabled on key tables.
*/

-- Create all tables first
CREATE TABLE IF NOT EXISTS direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to uuid REFERENCES direct_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light','dark','system')),
  reduced_motion boolean NOT NULL DEFAULT false,
  notification_sound boolean NOT NULL DEFAULT true,
  push_notifications boolean NOT NULL DEFAULT false,
  allow_dm_from text NOT NULL DEFAULT 'everyone' CHECK (allow_dm_from IN ('everyone','friends','nobody')),
  show_avatars boolean NOT NULL DEFAULT true,
  font_size text NOT NULL DEFAULT 'medium' CHECK (font_size IN ('small','medium','large')),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS read_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES direct_conversations(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id),
  UNIQUE (user_id, conversation_id),
  CHECK (channel_id IS NOT NULL OR conversation_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_states ENABLE ROW LEVEL SECURITY;

-- DIRECT CONVERSATIONS policies
DROP POLICY IF EXISTS "dc_select" ON direct_conversations;
CREATE POLICY "dc_select" ON direct_conversations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = direct_conversations.id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "dc_insert" ON direct_conversations;
CREATE POLICY "dc_insert" ON direct_conversations FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());
DROP POLICY IF EXISTS "dc_update" ON direct_conversations;
CREATE POLICY "dc_update" ON direct_conversations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = direct_conversations.id AND cm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = direct_conversations.id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "dc_delete" ON direct_conversations;
CREATE POLICY "dc_delete" ON direct_conversations FOR DELETE
  TO authenticated USING (created_by = auth.uid());

-- CONVERSATION MEMBERS policies
DROP POLICY IF EXISTS "conv_members_select" ON conversation_members;
CREATE POLICY "conv_members_select" ON conversation_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "conv_members_insert" ON conversation_members;
CREATE POLICY "conv_members_insert" ON conversation_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_members cm
      JOIN direct_conversations dc ON dc.id = cm.conversation_id
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid() AND dc.created_by = auth.uid()
    )
  );
DROP POLICY IF EXISTS "conv_members_delete" ON conversation_members;
CREATE POLICY "conv_members_delete" ON conversation_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM direct_conversations dc WHERE dc.id = conversation_members.conversation_id AND dc.created_by = auth.uid())
  );

-- DIRECT MESSAGES policies
DROP POLICY IF EXISTS "dm_select" ON direct_messages;
CREATE POLICY "dm_select" ON direct_messages FOR SELECT
  TO authenticated USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = direct_messages.conversation_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "dm_insert" ON direct_messages;
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT
  TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = direct_messages.conversation_id AND cm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "dm_update_own" ON direct_messages;
CREATE POLICY "dm_update_own" ON direct_messages FOR UPDATE
  TO authenticated USING (author_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "dm_delete_own" ON direct_messages;
CREATE POLICY "dm_delete_own" ON direct_messages FOR DELETE
  TO authenticated USING (author_id = auth.uid());

-- MESSAGE REACTIONS policies
DROP POLICY IF EXISTS "reactions_select" ON message_reactions;
CREATE POLICY "reactions_select" ON message_reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channels ch ON ch.id = m.channel_id
      JOIN community_members cm ON cm.community_id = ch.community_id
      WHERE m.id = message_reactions.message_id AND cm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "reactions_insert" ON message_reactions;
CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN channels ch ON ch.id = m.channel_id
      JOIN community_members cm ON cm.community_id = ch.community_id
      WHERE m.id = message_reactions.message_id AND cm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "reactions_delete_own" ON message_reactions;
CREATE POLICY "reactions_delete_own" ON message_reactions FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- NOTIFICATIONS policies
DROP POLICY IF EXISTS "notif_select" ON notifications;
CREATE POLICY "notif_select" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- USER BLOCKS policies
DROP POLICY IF EXISTS "blocks_select" ON user_blocks;
CREATE POLICY "blocks_select" ON user_blocks FOR SELECT
  TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocks_insert" ON user_blocks;
CREATE POLICY "blocks_insert" ON user_blocks FOR INSERT
  TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocks_delete" ON user_blocks;
CREATE POLICY "blocks_delete" ON user_blocks FOR DELETE
  TO authenticated USING (blocker_id = auth.uid());

-- USER PREFERENCES policies
DROP POLICY IF EXISTS "prefs_select" ON user_preferences;
CREATE POLICY "prefs_select" ON user_preferences FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "prefs_insert" ON user_preferences;
CREATE POLICY "prefs_insert" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "prefs_update" ON user_preferences;
CREATE POLICY "prefs_update" ON user_preferences FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- READ STATES policies
DROP POLICY IF EXISTS "read_select" ON read_states;
CREATE POLICY "read_select" ON read_states FOR SELECT
  TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "read_insert" ON read_states;
CREATE POLICY "read_insert" ON read_states FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "read_update" ON read_states;
CREATE POLICY "read_update" ON read_states FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "read_delete" ON read_states;
CREATE POLICY "read_delete" ON read_states FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE community_members;