import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Community, Channel, Category, DirectConversation, Profile } from '@/lib/types';
import {
  ChevronLeft, Hash, Lock, MessageSquarePlus, Users, Plus,
} from 'lucide-react';

interface Props {
  community: Community | null;
  onSelectChannel: (communityId: string, channel: Channel) => void;
  onSelectDM: (conversation: DirectConversation) => void;
  onBackToCommunities: () => void;
}

export function ChannelsSidebar({ community, onSelectChannel, onSelectDM, onBackToCommunities }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<{ user_id: string; role: string; profile?: Profile }[]>([]);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [convMembers, setConvMembers] = useState<Record<string, Profile[]>>({});
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation:direct_conversations(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    if (data) {
      const convs = data.map((d: any) => d.conversation as DirectConversation);
      setConversations(convs);
      // Load members for each conversation
      for (const conv of convs) {
        const { data: mData } = await supabase
          .from('conversation_members')
          .select('profile:profiles(*)')
          .eq('conversation_id', conv.id);
        if (mData) {
          setConvMembers(prev => ({
            ...prev,
            [conv.id]: mData.map((m: any) => m.profile as Profile).filter(Boolean),
          }));
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    if (!community) return;
    (async () => {
      const [{ data: catData }, { data: chData }, { data: memData }] = await Promise.all([
        supabase.from('categories').select('*').eq('community_id', community.id).order('position'),
        supabase.from('channels').select('*').eq('community_id', community.id).order('position'),
        supabase
          .from('community_members')
          .select('user_id, role, profile:profiles(*)')
          .eq('community_id', community.id)
          .order('joined_at', { ascending: true }),
      ]);
      setCategories(catData as Category[] || []);
      setChannels(chData as Channel[] || []);
      if (memData) {
        setMembers(memData.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          profile: m.profile,
        })));
      }
    })();
  }, [community]);

  async function handleCreateChannel(name: string, description: string, isPrivate: boolean) {
    if (!community) return;
    const { data } = await supabase
      .from('channels')
      .insert({
        community_id: community.id,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        description,
        is_private: isPrivate,
      })
      .select('*')
      .single();
    if (data) {
      setChannels(prev => [...prev, data as Channel]);
    }
    setShowCreateChannel(false);
  }

  async function handleStartDM(targetUser: Profile) {
    if (!user) return;
    // Check if conversation already exists between these two users
    const existing = conversations.find(c => {
      const members = convMembers[c.id];
      return !c.is_group && members && members.length === 2 && members.some(m => m.id === targetUser.id);
    });
    if (existing) {
      onSelectDM(existing);
      setShowNewDM(false);
      return;
    }
    // Create new 1:1 conversation
    const { data: conv } = await supabase
      .from('direct_conversations')
      .insert({ is_group: false, created_by: user.id })
      .select('*')
      .single();
    if (!conv) return;
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: targetUser.id },
    ]);
    const newConv = conv as DirectConversation;
    setConversations(prev => [newConv, ...prev]);
    setConvMembers(prev => ({ ...prev, [newConv.id]: [targetUser] }));
    onSelectDM(newConv);
    setShowNewDM(false);
  }

  const uncategorized = channels.filter(c => !c.category_id);
  const channelsByCategory = (catId: string) => channels.filter(c => c.category_id === catId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-default">
        <button
          onClick={onBackToCommunities}
          className="md:hidden btn-ghost -ml-2 mb-2 text-sm"
        >
          <ChevronLeft size={16} /> Communities
        </button>
        {community ? (
          <div>
            <h2 className="font-bold text-lg text-main truncate flex items-center gap-2">
              {community.icon_url ? (
                <img src={community.icon_url} alt="" className="w-6 h-6 rounded-lg object-cover" />
              ) : (
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              )}
              {community.name}
            </h2>
            {community.description && (
              <p className="text-xs text-muted mt-1 line-clamp-2">{community.description}</p>
            )}
          </div>
        ) : (
          <h2 className="font-bold text-lg text-main">Direct Messages</h2>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-3 pb-2 border-b border-default">
        {community && (
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
              activeTab === 'channels' ? 'bg-surface text-main' : 'text-sub hover:text-main'
            }`}
          >
            Channels
          </button>
        )}
        <button
          onClick={() => setActiveTab('dms')}
          className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${
            activeTab === 'dms' ? 'bg-surface text-main' : 'text-sub hover:text-main'
          }`}
        >
          Messages
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {activeTab === 'channels' && community && (
          <>
            {uncategorized.length > 0 && (
              <ChannelGroup label="General">
                {uncategorized.map(ch => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    active={activeChannelId === ch.id}
                    onClick={() => {
                      setActiveChannelId(ch.id);
                      onSelectChannel(community.id, ch);
                    }}
                  />
                ))}
              </ChannelGroup>
            )}
            {categories.map(cat => (
              <ChannelGroup key={cat.id} label={cat.name}>
                {channelsByCategory(cat.id).map(ch => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    active={activeChannelId === ch.id}
                    onClick={() => {
                      setActiveChannelId(ch.id);
                      onSelectChannel(community.id, ch);
                    }}
                  />
                ))}
              </ChannelGroup>
            ))}
            {channels.length === 0 && (
              <div className="text-center py-8 px-4">
                <Hash size={24} className="mx-auto text-muted mb-2" />
                <p className="text-sm text-sub">No channels yet</p>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="btn-secondary mt-3 text-sm py-2"
                >
                  <Plus size={16} /> Create channel
                </button>
              </div>
            )}
            {channels.length > 0 && (
              <button
                onClick={() => setShowCreateChannel(true)}
                className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sub hover:text-main hover:bg-surface transition-colors text-sm"
              >
                <Plus size={16} /> New channel
              </button>
            )}
          </>
        )}

        {activeTab === 'dms' && (
          <>
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquarePlus size={24} className="mx-auto text-muted mb-2" />
                <p className="text-sm text-sub">No conversations yet</p>
                <button
                  onClick={() => setShowNewDM(true)}
                  className="btn-secondary mt-3 text-sm py-2"
                >
                  <Plus size={16} /> Start a conversation
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowNewDM(true)}
                  className="w-full mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sub hover:text-main hover:bg-surface transition-colors text-sm"
                >
                  <Plus size={16} /> New message
                </button>
                {conversations.map(conv => {
                  const members = convMembers[conv.id] || [];
                  const otherMembers = members.filter(m => m.id !== user?.id);
                  const displayName = conv.is_group
                    ? conv.name || 'Group chat'
                    : otherMembers[0]?.display_name || 'Unknown';
                  const avatarUrl = conv.is_group ? null : otherMembers[0]?.avatar_url;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => onSelectDM(conv)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-sm text-main truncate flex-1">{displayName}</span>
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer — members */}
      {community && activeTab === 'channels' && (
        <div className="border-t border-default p-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sub hover:text-main hover:bg-surface transition-colors text-sm"
          >
            <Users size={16} />
            <span>Members — {members.length}</span>
          </button>
          {showMembers && (
            <div className="mt-1 max-h-48 overflow-y-auto animate-slide-up">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                    {m.profile?.avatar_url ? (
                      <img src={m.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (m.profile?.display_name || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-sub truncate flex-1">{m.profile?.display_name || 'Unknown'}</span>
                  {m.role !== 'member' && (
                    <span className="text-[10px] text-violet-400 font-medium capitalize">{m.role}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create channel modal */}
      {showCreateChannel && (
        <CreateChannelModal onClose={() => setShowCreateChannel(false)} onCreate={handleCreateChannel} />
      )}

      {/* New DM modal */}
      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onStart={handleStartDM}
          excludeUserId={user?.id}
          communityMembers={members.map(m => m.profile).filter((p): p is Profile => p !== undefined)}
        />
      )}
    </div>
  );
}

function ChannelGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChannelItem({ channel, active, onClick }: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm group ${
        active ? 'bg-surface text-main' : 'text-sub hover:text-main hover:bg-surface/60'
      }`}
    >
      {channel.is_private ? (
        <Lock size={16} className={active ? 'text-violet-400' : 'text-muted'} />
      ) : (
        <Hash size={16} className={active ? 'text-sky-400' : 'text-muted'} />
      )}
      <span className="truncate flex-1 text-left">{channel.name}</span>
    </button>
  );
}

function CreateChannelModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string, description: string, isPrivate: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <ModalShell title="Create channel" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim(), description.trim(), isPrivate); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Channel name</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                {isPrivate ? <Lock size={16} /> : <Hash size={16} />}
              </span>
              <input
                type="text"
                className="input pl-10"
                placeholder="new-channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Description (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isPrivate ? 'bg-violet-500' : 'bg-surface-2 border border-default'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-sub">Private channel</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </ModalShell>
  );
}

function NewDMModal({ onClose, onStart, excludeUserId, communityMembers }: {
  onClose: () => void;
  onStart: (user: Profile) => void;
  excludeUserId?: string;
  communityMembers: Profile[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    (async () => {
      if (query.trim().length < 1) {
        setResults(communityMembers.filter(m => m.id !== excludeUserId).slice(0, 10));
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', excludeUserId || '')
        .limit(10);
      setResults((data as Profile[]) || []);
    })();
  }, [query, excludeUserId, communityMembers]);

  return (
    <ModalShell title="Start a conversation" onClose={onClose}>
      <input
        type="text"
        className="input mb-4"
        placeholder="Search by username or name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {results.length === 0 ? (
          <p className="text-center text-sm text-sub py-8">No people found.</p>
        ) : (
          results.map(p => (
            <button
              key={p.id}
              onClick={() => onStart(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  p.display_name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-main font-medium truncate">{p.display_name}</p>
                <p className="text-xs text-muted truncate">@{p.username}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </ModalShell>
  );
}

export function ModalShell({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6 animate-pop shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-main">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5 -mr-1.5" aria-label="Close">
            <span className="sr-only">Close</span>
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
