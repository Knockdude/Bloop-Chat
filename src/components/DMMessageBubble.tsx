import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DirectMessage } from '@/lib/types';
import { Edit2, Trash2, MoreHorizontal, Check, X } from 'lucide-react';

interface Props {
  message: DirectMessage;
  showHeader: boolean;
  isOwn: boolean;
}

export function DMMessageBubble({ message, showHeader, isOwn }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  async function handleEdit() {
    if (!editText.trim() || editText.trim() === message.content) {
      setEditing(false);
      return;
    }
    const { error } = await supabase
      .from('direct_messages')
      .update({ content: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', message.id);
    if (!error) setEditing(false);
  }

  async function handleDelete() {
    await supabase.from('direct_messages').delete().eq('id', message.id);
    setShowMenu(false);
  }

  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const editedLabel = message.edited_at ? ' (edited)' : '';

  return (
    <div className={`group relative flex gap-3 px-2 py-0.5 rounded-lg hover:bg-surface/40 transition-colors ${showHeader ? 'mt-3' : ''}`}>
      <div className="w-10 shrink-0">
        {showHeader ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm">
            {message.author?.avatar_url ? (
              <img src={message.author.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              (message.author?.display_name || '?').charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <span className="hidden group-hover:block absolute left-2 top-1 text-[10px] text-muted pt-1">
            {time}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm text-main">{message.author?.display_name || 'Unknown'}</span>
            <span className="text-[11px] text-muted">{time}{editedLabel}</span>
          </div>
        )}

        {editing ? (
          <div className="mt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="input text-sm py-2 min-h-[60px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') { setEditing(false); setEditText(message.content); }
              }}
            />
            <div className="flex gap-2 mt-1.5">
              <button onClick={handleEdit} className="btn-primary py-1.5 px-3 text-xs">
                <Check size={14} /> Save
              </button>
              <button onClick={() => { setEditing(false); setEditText(message.content); }} className="btn-secondary py-1.5 px-3 text-xs">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-main leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>

      {isOwn && (
        <div className="absolute right-2 -top-3 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
          <div className="flex items-center bg-surface border border-default rounded-lg shadow-sm">
            <button
              onClick={() => { setEditing(true); setShowMenu(false); }}
              className="p-1.5 text-muted hover:text-main transition-colors"
              aria-label="Edit"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-muted hover:text-main transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
          {showMenu && (
            <div className="absolute top-full right-0 mt-1 bg-surface border border-default rounded-lg shadow-lg py-1 min-w-[120px] animate-pop z-10">
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
