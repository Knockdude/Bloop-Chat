import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ModalShell } from '@/components/ChannelsSidebar';
import { Loader2, Camera, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ProfilePanel({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [status, setStatus] = useState(profile?.status || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        status: status.trim(),
      })
      .eq('id', profile!.id);
    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      await refreshProfile();
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (!profile) return null;

  return (
    <ModalShell title="Your profile" onClose={onClose}>
      <div className="space-y-5">
        {/* Banner + avatar preview */}
        <div className="relative">
          <div className="h-24 rounded-xl bg-gradient-to-br from-sky-400 via-sky-500 to-violet-500" />
          <div className="absolute -bottom-8 left-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white text-xl font-bold ring-4 ring-white dark:ring-navy-900">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                profile.display_name.charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Username</label>
            <input
              type="text"
              className="input bg-surface-2/50"
              value={profile.username}
              disabled
            />
            <p className="text-xs text-muted mt-1">Your username can't be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Display name</label>
            <input
              type="text"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Status</label>
            <input
              type="text"
              className="input"
              placeholder="What's on your mind?"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sub mb-1.5">Bio</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Tell people about yourself"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
            />
            <p className="text-xs text-muted mt-1 text-right">{bio.length}/300</p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : null}
              {saved ? 'Saved!' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
