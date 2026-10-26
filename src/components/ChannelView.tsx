import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Channel, Message, Profile, MessageReaction } from '@/lib/types';
import { MessageEditor } from '@/components/MessageEditor';
import { MessageBubble } from '@/components/MessageBubble';
import { Hash, Lock, ChevronLeft, Users, AlertCircle, Loader2 } from 'lucide-react';

const PAGE_SIZE = 30;

interface Props {
  channel: Channel;
  communityId: string;
  onOpenChannels: () => void;
}

export function ChannelView({ channel, communityId, onOpenChannels }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; content: string } | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestRef = useRef<string | null>(null);
  const profilesCache = useRef<Record<string, Profile>>({});

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setError('Could not load messages. Please try again.');
      setLoading(false);
      return;
    }

    const msgs = (data as Message[]) || [];
    // Fetch author profiles
    const authorIds = [...new Set(msgs.map(m => m.author_id))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);
      if (profiles) {
        profiles.forEach(p => { profilesCache.current[p.id] = p as Profile; });
      }
    }

    // Fetch reactions
    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', msgs.map(m => m.id));
    const reactionMap: Record<string, MessageReaction[]> = {};
    if (reactions) {
      reactions.forEach(r => {
        const mr = r as MessageReaction;
        if (!reactionMap[mr.message_id]) reactionMap[mr.message_id] = [];
        reactionMap[mr.message_id].push(mr);
      });
    }

    const enriched = msgs.map(m => ({
      ...m,
      author: profilesCache.current[m.author_id],
      reactions: reactionMap[m.id] || [],
    })).reverse();

    setMessages(enriched);
    if (enriched.length > 0) oldestRef.current = enriched[0].created_at;
    setHasMore(msgs.length === PAGE_SIZE);
    setLoading(false);

    // Scroll to bottom
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [channel.id]);

  useEffect(() => {
    loadMessages();
    (async () => {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);
      setMemberCount(count || 0);
    })();

    // Mark as read
    if (user) {
      supabase.from('read_states').upsert({
        user_id: user.id,
        channel_id: channel.id,
        last_read_at: new Date().toISOString(),
      }).then(() => {});
    }
  }, [channel.id, communityId, user, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channelSub = supabase
      .channel(`messages:${channel.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        async (payload) => {
          const newMsg = payload.new as Message;
          if (!profilesCache.current[newMsg.author_id]) {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', newMsg.author_id).maybeSingle();
            if (p) profilesCache.current[newMsg.author_id] = p as Profile;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, author: profilesCache.current[newMsg.author_id], reactions: [] }];
          });
          // Auto-scroll if near bottom
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const el = scrollRef.current;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
              if (nearBottom) el.scrollTop = el.scrollHeight;
            }
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        async (payload) => {
          const reaction = payload.new as MessageReaction;
          if (!reaction) return;
          // Refetch reactions for that message
          const { data: allReactions } = await supabase
            .from('message_reactions')
            .select('*')
            .eq('message_id', reaction.message_id);
          setMessages(prev => prev.map(m =>
            m.id === reaction.message_id ? { ...m, reactions: (allReactions as MessageReaction[]) || [] } : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [channel.id]);

  async function loadMore() {
    if (loadingMore || !hasMore || !oldestRef.current) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .lt('created_at', oldestRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    const msgs = (data as Message[]) || [];
    if (msgs.length === 0) { setHasMore(false); setLoadingMore(false); return; }

    const authorIds = [...new Set(msgs.map(m => m.author_id))];
    const missing = authorIds.filter(id => !profilesCache.current[id]);
    if (missing.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', missing);
      if (profiles) profiles.forEach(p => { profilesCache.current[p.id] = p as Profile; });
    }

    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', msgs.map(m => m.id));
    const reactionMap: Record<string, MessageReaction[]> = {};
    if (reactions) {
      reactions.forEach(r => {
        const mr = r as MessageReaction;
        if (!reactionMap[mr.message_id]) reactionMap[mr.message_id] = [];
        reactionMap[mr.message_id].push(mr);
      });
    }

    const enriched = msgs.map(m => ({
      ...m,
      author: profilesCache.current[m.author_id],
      reactions: reactionMap[m.id] || [],
    })).reverse();

    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;

    setMessages(prev => [...enriched, ...prev]);
    oldestRef.current = enriched[0]?.created_at || oldestRef.current;
    setHasMore(msgs.length === PAGE_SIZE);

    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
    });
    setLoadingMore(false);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 50 && hasMore) loadMore();
  }

  async function handleSend(content: string, replyToId?: string | null) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channel.id,
        content,
        reply_to: replyToId || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    // The realtime subscription will add it, but add immediately for responsiveness
    if (data) {
      const msg = data as Message;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg, author: profilesCache.current[msg.author_id], reactions: [] }];
      });
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-default flex items-center px-4 gap-3 shrink-0 bg-surface/50 backdrop-blur-sm">
        <button onClick={onOpenChannels} className="md:hidden btn-ghost p-1.5 -ml-1.5" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {channel.is_private ? (
            <Lock size={20} className="text-violet-400 shrink-0" />
          ) : (
            <Hash size={20} className="text-sky-400 shrink-0" />
          )}
          <h2 className="font-bold text-main truncate">{channel.name}</h2>
        </div>
        {channel.description && (
          <>
            <div className="w-px h-5 bg-default hidden sm:block" />
            <p className="text-sm text-sub truncate hidden sm:block">{channel.description}</p>
          </>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted shrink-0">
          <Users size={16} />
          <span>{memberCount}</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sub mb-3">{error}</p>
            <button onClick={loadMessages} className="btn-secondary">Try again</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              {channel.is_private ? <Lock size={28} className="text-violet-400" /> : <Hash size={28} className="text-sky-400" />}
            </div>
            <h3 className="font-bold text-main mb-1">Welcome to #{channel.name}</h3>
            <p className="text-sub text-sm max-w-xs">This is the start of the conversation. Send a message to get things going.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                Load older messages
              </button>
            )}
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showHeader = !prev || prev.author_id !== msg.author_id ||
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  showHeader={showHeader}
                  isOwn={msg.author_id === user?.id}
                  onReply={() => setReplyTo({
                    id: msg.id,
                    author: msg.author?.display_name || 'Unknown',
                    content: msg.content,
                  })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="shrink-0">
        <MessageEditor
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={`Message #${channel.name}`}
        />
      </div>
    </div>
  );
}
