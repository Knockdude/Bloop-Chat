import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Community } from '@/lib/types';
import { Plus, Compass, Hash, Lock } from 'lucide-react';

interface Props {
  communities: Community[];
  onCommunitiesChange: (c: Community[]) => void;
  activeCommunityId: string | null;
  onSelectCommunity: (id: string) => void;
  onCreateCommunity: () => void;
}

export function CommunitiesSidebar({
  communities,
  onCommunitiesChange,
  activeCommunityId,
  onSelectCommunity,
  onCreateCommunity,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('community_members')
        .select('community:communities(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true });
      if (data) {
        onCommunitiesChange(data.map((d: any) => d.community as Community));
      }
      setLoading(false);
    })();
  }, [user, onCommunitiesChange]);

  return (
    <div className="flex flex-col items-center gap-2 flex-1 overflow-y-auto py-2">
      {loading ? (
        <div className="flex flex-col gap-2 w-full px-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-12 h-12 mx-auto rounded-2xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {communities.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectCommunity(c.id)}
              className={`group relative w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl ${
                activeCommunityId === c.id
                  ? 'bg-gradient-to-br from-sky-500 to-violet-500 text-white'
                  : 'bg-surface-2 text-sub hover:text-main hover:bg-navy-600/40'
              }`}
              title={c.name}
              aria-label={c.name}
            >
              {c.icon_url ? (
                <img src={c.icon_url} alt="" className="w-full h-full rounded-2xl object-cover group-hover:rounded-xl transition-all" />
              ) : (
                <span className="font-bold text-base">{c.name.charAt(0).toUpperCase()}</span>
              )}
              {c.visibility === 'private' && (
                <Lock size={10} className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-navy-800 rounded-full text-navy-200" />
              )}
              {activeCommunityId === c.id && (
                <span className="absolute -left-2 w-1 h-8 rounded-r-full bg-white" />
              )}
            </button>
          ))}
          <div className="w-8 h-px bg-default my-1" />
          <button
            onClick={onCreateCommunity}
            className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center bg-surface-2 text-sky-500 hover:bg-sky-500 hover:text-white transition-all duration-200 hover:rounded-xl"
            title="Create a community"
            aria-label="Create a community"
          >
            <Plus size={22} />
          </button>
        </>
      )}
    </div>
  );
}
