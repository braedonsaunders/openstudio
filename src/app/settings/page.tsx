'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AvatarEditor } from '@/components/avatar/AvatarEditor';
import { INSTRUMENTS } from '@/types/user';
import {
  ArrowLeft,
  User,
  Palette,
  Music,
  Bell,
  Shield,
  Save,
  Check,
  Plus,
  Star,
  Trash2,
  Globe,
  Link as LinkIcon,
} from 'lucide-react';

type Tab = 'profile' | 'avatar' | 'instruments' | 'privacy' | 'notifications';

export default function SettingsPage() {
  const router = useRouter();
  const {
    profile,
    avatar,
    instruments,
    updateProfile,
    addInstrument,
    setPrimaryInstrument,
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [website, setWebsite] = useState(profile?.links?.website || '');
  const [spotify, setSpotify] = useState(profile?.links?.spotify || '');
  const [soundcloud, setSoundcloud] = useState(profile?.links?.soundcloud || '');

  // Privacy form state
  const [profileVisibility, setProfileVisibility] = useState(profile?.privacy?.profileVisibility || 'public');
  const [showStats, setShowStats] = useState(profile?.privacy?.showStats ?? true);
  const [showActivity, setShowActivity] = useState(profile?.privacy?.showActivity ?? true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(profile?.privacy?.allowFriendRequests ?? true);

  // Notifications form state
  const [emailNotifications, setEmailNotifications] = useState(profile?.preferences?.emailNotifications ?? true);
  const [soundNotifications, setSoundNotifications] = useState(profile?.preferences?.soundNotifications ?? true);

  if (!profile) {
    router.push('/');
    return null;
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName,
        bio,
        links: {
          website: website || undefined,
          spotify: spotify || undefined,
          soundcloud: soundcloud || undefined,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        privacy: {
          profileVisibility: profileVisibility as 'public' | 'friends' | 'private',
          showStats,
          showActivity,
          allowFriendRequests,
          allowRoomInvites: true,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        preferences: {
          ...profile.preferences,
          emailNotifications,
          soundNotifications,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddInstrument = async (instrumentId: string) => {
    const instrument = INSTRUMENTS[instrumentId];
    if (instrument) {
      await addInstrument(instrumentId, instrument.category, instruments.length === 0);
    }
  };

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'avatar', icon: Palette, label: 'Avatar' },
    { id: 'instruments', icon: Music, label: 'Instruments' },
    { id: 'privacy', icon: Shield, label: 'Privacy' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <nav className="w-full md:w-56 shrink-0">
            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>
                <div className="space-y-4">
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you want to be called"
                  />
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{bio.length}/500</p>
                  </div>

                  <div className="border-t border-gray-800 pt-4 mt-6">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Social Links
                    </h3>
                    <div className="space-y-3">
                      <Input
                        label="Website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                      />
                      <Input
                        label="Spotify"
                        value={spotify}
                        onChange={(e) => setSpotify(e.target.value)}
                        placeholder="https://open.spotify.com/artist/..."
                      />
                      <Input
                        label="SoundCloud"
                        value={soundcloud}
                        onChange={(e) => setSoundcloud(e.target.value)}
                        placeholder="https://soundcloud.com/..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveProfile} loading={isSaving}>
                      {saveSuccess ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'avatar' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Customize Avatar</h2>
                <AvatarEditor
                  onSave={() => {
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2000);
                  }}
                />
              </Card>
            )}

            {activeTab === 'instruments' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Your Instruments</h2>

                {/* Current Instruments */}
                <div className="space-y-3 mb-6">
                  {instruments.length > 0 ? (
                    instruments.map((inst) => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          inst.isPrimary
                            ? 'bg-indigo-500/10 border border-indigo-500/20'
                            : 'bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {INSTRUMENTS[inst.instrumentId]?.icon || '🎵'}
                          </span>
                          <div>
                            <p className="text-white font-medium">
                              {INSTRUMENTS[inst.instrumentId]?.name || inst.instrumentId}
                            </p>
                            <p className="text-sm text-gray-400">
                              Level {inst.level} • {Math.round(inst.totalHours)}h played
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.isPrimary ? (
                            <span className="text-xs text-indigo-400 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Primary
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrimaryInstrument(inst.instrumentId)}
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No instruments added yet. Add your first instrument below!
                    </p>
                  )}
                </div>

                {/* Add Instrument */}
                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-sm font-medium text-white mb-4">Add Instrument</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(INSTRUMENTS)
                      .filter(([id]) => !instruments.find((i) => i.instrumentId === id))
                      .slice(0, 12)
                      .map(([id, inst]) => (
                        <button
                          key={id}
                          onClick={() => handleAddInstrument(id)}
                          className="flex items-center gap-2 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <span className="text-xl">{inst.icon}</span>
                          <span className="text-sm text-gray-300">{inst.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'privacy' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Privacy Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Profile Visibility</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['public', 'friends', 'private'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => setProfileVisibility(option)}
                          className={`px-4 py-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                            profileVisibility === option
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ToggleSetting
                    label="Show Statistics"
                    description="Allow others to see your jam stats on your profile"
                    checked={showStats}
                    onChange={setShowStats}
                  />
                  <ToggleSetting
                    label="Show Activity"
                    description="Show your activity heatmap on your profile"
                    checked={showActivity}
                    onChange={setShowActivity}
                  />
                  <ToggleSetting
                    label="Allow Friend Requests"
                    description="Let other users send you friend requests"
                    checked={allowFriendRequests}
                    onChange={setAllowFriendRequests}
                  />

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSavePrivacy} loading={isSaving}>
                      {saveSuccess ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Notification Settings</h2>
                <div className="space-y-6">
                  <ToggleSetting
                    label="Email Notifications"
                    description="Receive email updates about your account"
                    checked={emailNotifications}
                    onChange={setEmailNotifications}
                  />
                  <ToggleSetting
                    label="Sound Notifications"
                    description="Play sounds for in-app notifications"
                    checked={soundNotifications}
                    onChange={setSoundNotifications}
                  />

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveNotifications} loading={isSaving}>
                      {saveSuccess ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-indigo-500' : 'bg-gray-700'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
