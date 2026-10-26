import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ThemeMode, FontSize } from '@/lib/types';
import { useTheme } from '@/context/ThemeContext';
import { ModalShell } from '@/components/ChannelsSidebar';
import { Sun, Moon, Monitor, Bell, Volume2, Eye, Zap, User, Palette, Shield } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { theme, fontSize, reducedMotion, setTheme, setFontSize, setReducedMotion, resolved } = useTheme();
  const [tab, setTab] = useState<'appearance' | 'notifications' | 'accessibility' | 'account'>('appearance');

  return (
    <ModalShell title="Settings" onClose={onClose}>
      <div className="flex flex-col sm:flex-row gap-4 min-h-[320px]">
        {/* Tabs */}
        <div className="flex sm:flex-col gap-1 shrink-0 sm:w-40 border-b sm:border-b-0 sm:border-r border-default pb-2 sm:pb-0 sm:pr-3">
          <TabButton active={tab === 'appearance'} onClick={() => setTab('appearance')} icon={<Palette size={16} />}>Appearance</TabButton>
          <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')} icon={<Bell size={16} />}>Notifications</TabButton>
          <TabButton active={tab === 'accessibility'} onClick={() => setTab('accessibility')} icon={<Eye size={16} />}>Accessibility</TabButton>
          <TabButton active={tab === 'account'} onClick={() => setTab('account')} icon={<User size={16} />}>Account</TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'appearance' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-sub mb-2">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  <ThemeOption active={theme === 'light'} onClick={() => setTheme('light')} icon={<Sun size={18} />} label="Light" />
                  <ThemeOption active={theme === 'dark'} onClick={() => setTheme('dark')} icon={<Moon size={18} />} label="Dark" />
                  <ThemeOption active={theme === 'system'} onClick={() => setTheme('system')} icon={<Monitor size={18} />} label="System" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sub mb-2">Text size</label>
                <div className="grid grid-cols-3 gap-2">
                  <ThemeOption active={fontSize === 'small'} onClick={() => setFontSize('small')} label="Small" />
                  <ThemeOption active={fontSize === 'medium'} onClick={() => setFontSize('medium')} label="Medium" />
                  <ThemeOption active={fontSize === 'large'} onClick={() => setFontSize('large')} label="Large" />
                </div>
              </div>

              <p className="text-xs text-muted">Currently using {resolved} mode.</p>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4 animate-fade-in">
              <ToggleRow
                icon={<Volume2 size={18} />}
                label="Notification sounds"
                description="Play a sound when you receive a new message"
                value={true}
                onChange={() => { /* would persist to user_preferences */ }}
              />
              <ToggleRow
                icon={<Bell size={18} />}
                label="Push notifications"
                description="Get notified in your browser even when BLOOP isn't open"
                value={false}
                onChange={() => { /* would request permission */ }}
              />
              <p className="text-xs text-muted pt-2">You can mute specific communities or channels individually from their settings.</p>
            </div>
          )}

          {tab === 'accessibility' && (
            <div className="space-y-4 animate-fade-in">
              <ToggleRow
                icon={<Zap size={18} />}
                label="Reduce motion"
                description="Minimize animations and transitions"
                value={reducedMotion}
                onChange={setReducedMotion}
              />
              <ToggleRow
                icon={<Eye size={18} />}
                label="Show avatars"
                description="Display profile pictures in messages and lists"
                value={true}
                onChange={() => { /* would persist */ }}
              />
              <p className="text-xs text-muted pt-2">BLOOP supports keyboard navigation. Use Tab to move between elements and Enter to activate them.</p>
            </div>
          )}

          {tab === 'account' && (
            <div className="space-y-4 animate-fade-in">
              <div className="card p-4 bg-surface-2">
                <p className="text-sm text-sub">Signed in as</p>
                <p className="font-medium text-main mt-1">{profile?.display_name || 'Unknown'}</p>
                <p className="text-sm text-muted">@{profile?.username || 'unknown'}</p>
              </div>
              <button
                onClick={async () => { await signOut(); onClose(); }}
                className="btn-danger w-full"
              >
                Sign out
              </button>
              <p className="text-xs text-muted text-center">BLOOP does not use end-to-end encryption. Messages are stored securely in the database and accessible to conversation participants and community moderators.</p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-surface text-main' : 'text-sub hover:text-main hover:bg-surface/60'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ThemeOption({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm transition-all ${
        active ? 'border-sky-400 bg-sky-500/10 text-main ring-2 ring-sky-400/20' : 'border-default bg-surface-2 text-sub hover:border-hover'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ToggleRow({ icon, label, description, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const [on, setOn] = useState(value);
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="text-muted mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-main">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => { setOn(!on); onChange(!on); }}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${on ? 'bg-sky-500' : 'bg-surface-2 border border-default'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
