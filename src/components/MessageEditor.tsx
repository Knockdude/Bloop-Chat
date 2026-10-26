import { useState, useRef, type KeyboardEvent } from 'react';
import { Loader2, Send, Smile, X, Reply } from 'lucide-react';

interface Props {
  onSend: (content: string, replyToId?: string | null) => Promise<void>;
  onEmoji?: () => void;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '👀', '✨', '😢', '😮', '🙏', '💯'];

export function MessageEditor({ onSend, replyTo, onCancelReply, placeholder = 'Send a message...', disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await onSend(content, replyTo?.id);
      setText('');
      if (onCancelReply) onCancelReply();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  return (
    <div className="px-4 pb-4 pt-2">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 text-sm animate-slide-up">
          <Reply size={14} className="text-muted shrink-0" />
          <span className="text-muted shrink-0">Replying to</span>
          <span className="text-sky-400 font-medium shrink-0">{replyTo.author}:</span>
          <span className="text-sub truncate flex-1">{replyTo.content}</span>
          <button onClick={onCancelReply} className="text-muted hover:text-main shrink-0" aria-label="Cancel reply">
            <X size={16} />
          </button>
        </div>
      )}

      {showEmojis && (
        <div className="mb-2 p-3 rounded-xl bg-surface border border-default animate-slide-up">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { setText(prev => prev + emoji); setShowEmojis(false); textareaRef.current?.focus(); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-2 text-lg transition-colors"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 bg-surface-2 rounded-2xl border border-default focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/20 transition-all p-1.5 pl-3">
        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className="btn-ghost p-2 shrink-0 text-muted hover:text-sky-400"
          aria-label="Insert emoji"
          type="button"
        >
          <Smile size={20} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-main resize-none outline-none py-2 max-h-40 placeholder:text-muted text-sm leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="btn-primary p-2.5 rounded-xl shrink-0"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
      <p className="text-[11px] text-muted mt-1.5 px-1">
        Press Enter to send, Shift+Enter for a new line
      </p>
    </div>
  );
}
