import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DirectConversation, DirectMessage, Profile } from '@/lib/types';
import { MessageEditor } from '@/components/MessageEditor';
import { DMMessageBubble } from '@/components/DMMessageBubble';
import { ChevronLeft, Users, AlertCircle, Loader2 } from 'lucide-react';

const PAGE_SIZE = 30;

interface Props {
  conversation: DirectConversation;
  onOpenChannels: () => void;
}

export function DMView({ conversation, onOpenChannels }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestRef = useRef<string | null>(null);
  const profilesCache = useRef<Record<string, Profile>>({});

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setError('Could not load messages.');
      setLoading(false);
      return;
    }

    const msgs = (data as DirectMessage[]) || [];
    const authorIds = [...new Set(msgs.map(m => m.author_id))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', authorIds);
      if (profiles) profiles.forEach(p => { profilesCache.current[p.id] = p as Profile; });
    }

    const enriched = msgs.map(m => ({ ...m, author: profilesCache.current[m.author_id] })).reverse();
    setMessages(enriched);
    if (enriched.length > 0) oldestRef.current = enriched[0].created_at;
    setHasMore(msgs.length === PAGE_SIZE);
    setLoading(false);

    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [conversation.id]);

  useEffect(() => {
    loadMessages();
    (async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('profile:profiles(*)')
        .eq('conversation_id', conversation.id);
      if (data) setMembers(data.map((d: any) => d.profile as Profile).filter(Boolean));
    })();

    if (user) {
      supabase.from('read_states').upsert({
        user_id: user.id,
        conversation_id: conversation.id,
        last_read_at: new Date().toISOString(),
      }).then(() => {});
    }
  }, [conversation.id, user, loadMessages]);

  useEffect(() => {
    const sub = supabase
      .channel(`dm:${conversation.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversation.id}` },
        async (payload) => {
          const newMsg = payload.new as DirectMessage;
          if (!profilesCache.current[newMsg.author_id]) {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', newMsg.author_id).maybeSingle();
            if (p) profilesCache.current[newMsg.author_id] = p as Profile;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, author: profilesCache.current[newMsg.author_id] }];
          });
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
        { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const updated = payload.new as DirectMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [conversation.id]);

  async function loadMore() {
    if (loadingMore || !hasMore || !oldestRef.current) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .lt('created_at', oldestRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    const msgs = (data as DirectMessage[]) || [];
    if (msgs.length === 0) { setHasMore(false); setLoadingMore(false); return; }

    const authorIds = [...new Set(msgs.map(m => m.author_id))];
    const missing = authorIds.filter(id => !profilesCache.current[id]);
    if (missing.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', missing);
      if (profiles) profiles.forEach(p => { profilesCache.current[p.id] = p as Profile; });
    }

    const enriched = msgs.map(m => ({ ...m, author: profilesCache.current[m.author_id] })).reverse();
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

  async function handleSend(content: string) {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({ conversation_id: conversation.id, content })
      .select('*')
      .single();
    if (error) throw error;
    if (data) {
      const msg = data as DirectMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg, author: profilesCache.current[msg.author_id] }];
      });
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
  }

  const otherMembers = members.filter(m => m.id !== user?.id);
  const title = conversation.is_group
    ? conversation.name || 'Group chat'
    : otherMembers[0]?.display_name || 'Unknown';

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-default flex items-center px-4 gap-3 shrink-0 bg-surface/50 backdrop-blur-sm">
        <button onClick={onOpenChannels} className="md:hidden btn-ghost p-1.5 -ml-1.5" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {otherMembers[0]?.avatar_url ? (
            <img src={otherMembers[0].avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-main truncate text-sm">{title}</h2>
          {conversation.is_group && (
            <p className="text-xs text-muted">{members.length} members</p>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
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
              <Users size={28} className="text-sky-400" />
            </div>
            <h3 className="font-bold text-main mb-1">This is the beginning of your conversation</h3>
            <p className="text-sub text-sm max-w-xs">Send a message to start chatting with {title}.</p>
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
                <DMMessageBubble
                  key={msg.id}
                  message={msg}
                  showHeader={showHeader}
                  isOwn={msg.author_id === user?.id}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0">
        <MessageEditor
          onSend={handleSend}
          placeholder={`Message ${title}`}
        />
      </div>
    </div>
  );
}
