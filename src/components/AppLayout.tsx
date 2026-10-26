import { useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { CommunitiesSidebar } from '@/components/CommunitiesSidebar';
import { ChannelsSidebar } from '@/components/ChannelsSidebar';
import { ChannelView } from '@/components/ChannelView';
import { DMView } from '@/components/DMView';
import { ProfilePanel } from '@/components/ProfilePanel';
import { SettingsModal } from '@/components/SettingsModal';
import { CreateCommunityModal } from '@/components/CreateCommunityModal';
import type { Channel, Community, DirectConversation } from '@/lib/types';
import { Menu, X, Settings, Bell } from 'lucide-react';

type View =
  | { type: 'channel'; communityId: string; channel: Channel }
  | { type: 'dm'; conversation: DirectConversation }
  | { type: 'home' };

export function AppLayout() {
  const { profile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ type: 'home' });
  const [mobilePanel, setMobilePanel] = useState<'communities' | 'channels' | 'content' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const activeCommunity = communities.find(c => c.id === activeCommunityId) ?? null;

  function selectChannel(communityId: string, channel: Channel) {
    setView({ type: 'channel', communityId, channel });
    setMobilePanel('content');
  }

  function selectDM(conversation: DirectConversation) {
    setView({ type: 'dm', conversation });
    setMobilePanel('content');
  }

  return (
    <div className="h-screen flex bg-base overflow-hidden text-main">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-default flex items-center justify-between px-4">
        <button
          onClick={() => setMobilePanel(mobilePanel === 'communities' ? null : 'communities')}
          className="btn-ghost p-2"
          aria-label="Toggle communities"
        >
          {mobilePanel === 'communities' ? <X size={20} /> : <Menu size={20} />}
        </button>
        <LogoMark size={28} />
        <button
          onClick={() => setMobilePanel(mobilePanel === 'channels' ? null : 'channels')}
          className="btn-ghost p-2"
          aria-label="Toggle channels"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Communities sidebar — narrow rail */}
      <div className={`
        ${mobilePanel === 'communities' ? 'fixed inset-y-0 left-0 z-40 pt-14' : 'hidden'}
        md:relative md:flex md:pt-0
        w-20 md:w-20 lg:w-24 bg-surface border-r border-default flex-col items-center py-4 gap-2 shrink-0
      `}>
        <div className="hidden md:flex mb-2">
          <LogoMark size={36} />
        </div>
        <div className="w-full px-3">
          <div className="h-px bg-default" />
        </div>
        <CommunitiesSidebar
          communities={communities}
          onCommunitiesChange={setCommunities}
          activeCommunityId={activeCommunityId}
          onSelectCommunity={(id) => {
            setActiveCommunityId(id);
            setMobilePanel('channels');
          }}
          onCreateCommunity={() => setShowCreateCommunity(true)}
        />
        <div className="mt-auto flex flex-col items-center gap-2">
          {profile && (
            <button
              onClick={() => setShowProfile(true)}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-transparent hover:ring-sky-400/50 transition-all"
              aria-label="Open profile"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                profile.display_name.charAt(0).toUpperCase()
              )}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost p-2.5 rounded-xl"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Channels sidebar */}
      <div className={`
        ${mobilePanel === 'channels' ? 'fixed inset-y-0 left-20 md:left-0 right-0 z-30 pt-14 md:pt-0 md:relative md:left-0' : 'hidden'}
        md:flex w-64 lg:w-72 bg-surface-2 border-r border-default flex-col shrink-0
      `}>
        <ChannelsSidebar
          community={activeCommunity}
          onSelectChannel={selectChannel}
          onSelectDM={selectDM}
          onBackToCommunities={() => setMobilePanel('communities')}
        />
      </div>

      {/* Main content area */}
      <div className={`
        ${mobilePanel === 'content' ? 'flex pt-14 md:pt-0' : 'hidden'}
        md:flex flex-1 flex-col min-w-0
      `}>
        {view.type === 'channel' && (
          <ChannelView
            channel={view.channel}
            communityId={view.communityId}
            onOpenChannels={() => setMobilePanel('channels')}
          />
        )}
        {view.type === 'dm' && (
          <DMView
            conversation={view.conversation}
            onOpenChannels={() => setMobilePanel('channels')}
          />
        )}
        {view.type === 'home' && (
          <HomeView />
        )}
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showCreateCommunity && (
        <CreateCommunityModal
          onClose={() => setShowCreateCommunity(false)}
          onCreated={(c) => {
            setCommunities(prev => [...prev, c]);
            setActiveCommunityId(c.id);
            setShowCreateCommunity(false);
            setMobilePanel('channels');
          }}
        />
      )}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function HomeView() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center mb-6 shadow-lg shadow-sky-500/20">
          <LogoMark size={48} className="!bg-transparent !shadow-none" />
        </div>
        <h2 className="text-xl font-bold text-main mb-2">Welcome to BLOOP</h2>
        <p className="text-sub leading-relaxed">
          Select a community from the left to start chatting, or create a new one to bring people together.
        </p>
      </div>
    </div>
  );
}
