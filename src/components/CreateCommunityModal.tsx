import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Community } from '@/lib/types';
import { ModalShell } from '@/components/ChannelsSidebar';
import { Loader2, Globe, Lock } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: (community: Community) => void;
}

export function CreateCommunityModal({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);

    const { data: community, error: commError } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        description: description.trim(),
        visibility,
        owner_id: user.id,
      })
      .select('*')
      .single();

    if (commError || !community) {
      setError(commError?.message || 'Could not create community.');
      setLoading(false);
      return;
    }

    // Add owner as member with 'owner' role
    await supabase.from('community_members').insert({
      community_id: community.id,
      user_id: user.id,
      role: 'owner',
    });

    // Create a default 'general' channel
    await supabase.from('channels').insert({
      community_id: community.id,
      name: 'general',
      description: 'General conversation',
      position: 0,
    });

    onCreated(community as Community);
    setLoading(false);
  }

  return (
    <ModalShell title="Create a community" onClose={onClose}>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-sub mb-1.5">Community name</label>
          <input
            type="text"
            className="input"
            placeholder="My Awesome Community"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            maxLength={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sub mb-1.5">Description (optional)</label>
          <textarea
            className="input min-h-[72px] resize-none"
            placeholder="What's this community about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sub mb-2">Visibility</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`p-4 rounded-xl border text-left transition-all ${
                visibility === 'public'
                  ? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-400/20'
                  : 'border-default bg-surface-2 hover:border-hover'
              }`}
            >
              <Globe size={20} className={visibility === 'public' ? 'text-sky-400' : 'text-muted'} />
              <p className="font-medium text-sm text-main mt-2">Public</p>
              <p className="text-xs text-muted mt-0.5">Anyone can find and join</p>
            </button>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`p-4 rounded-xl border text-left transition-all ${
                visibility === 'private'
                  ? 'border-violet-400 bg-violet-500/10 ring-2 ring-violet-400/20'
                  : 'border-default bg-surface-2 hover:border-hover'
              }`}
            >
              <Lock size={20} className={visibility === 'private' ? 'text-violet-400' : 'text-muted'} />
              <p className="font-medium text-sm text-main mt-2">Private</p>
              <p className="text-xs text-muted mt-0.5">Only with an invite</p>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading || !name.trim()} className="btn-primary flex-1">
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            Create
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
