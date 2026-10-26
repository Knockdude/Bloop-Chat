export type Role = 'owner' | 'admin' | 'moderator' | 'member';
export type Visibility = 'public' | 'private';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';
export type Availability = 'online' | 'idle' | 'dnd' | 'offline';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string;
  status: string;
  availability: Availability;
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  banner_url: string | null;
  visibility: Visibility;
  owner_id: string;
  rules: string;
  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profile?: Profile;
}

export interface Category {
  id: string;
  community_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Channel {
  id: string;
  community_id: string;
  category_id: string | null;
  name: string;
  description: string;
  is_private: boolean;
  position: number;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author?: Profile;
  reply?: Message | null;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface DirectConversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme: ThemeMode;
  reduced_motion: boolean;
  notification_sound: boolean;
  push_notifications: boolean;
  allow_dm_from: 'everyone' | 'friends' | 'nobody';
  show_avatars: boolean;
  font_size: FontSize;
  updated_at: string;
}

export interface ReadState {
  id: string;
  user_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  last_read_at: string;
}
