'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { useSavedTracksStore } from '@/stores/saved-tracks-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import dynamic from 'next/dynamic';

// Dynamically import canvas editor to avoid SSR issues with Konva
const AvatarCanvasEditor = dynamic(
  () => import('@/components/avatar/canvas').then((mod) => mod.AvatarCanvasEditor),
  { ssr: false }
);
import { SavedTrackCard } from '@/components/settings/SavedTrackCard';
import { SavedTrackEditor } from '@/components/settings/SavedTrackEditor';
import { SavedRoomsTab } from '@/components/settings/SavedRoomsTab';
import { InstrumentIcon } from '@/components/ui/instrument-icon';
import { INSTRUMENTS, getInstrumentEmoji, type SavedTrackPreset, type InstrumentCategory } from '@/types/user';
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
  Sliders,
  Loader2,
  Search,
  Sun,
  Moon,
  Monitor,
  Bookmark,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

// Instrument category labels
const INSTRUMENT_CATEGORY_LABELS: Record<InstrumentCategory, string> = {
  guitar: 'Guitars',
  keyboard: 'Keyboards',
  drums: 'Drums & Percussion',
  vocals: 'Vocals',
  strings: 'Strings',
  wind: 'Wind',
  electronic: 'Electronic',
  other: 'Other',
};

type Tab = 'profile' | 'avatar' | 'instruments' | 'tracks' | 'rooms' | 'appearance' | 'privacy' | 'notifications';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const {
    profile,
    instruments,
    updateProfile,
    addInstrument,
    setPrimaryInstrument,
    removeInstrument,
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

  // Instrument filter state
  const [instrumentSearch, setInstrumentSearch] = useState('');
  const [instrumentCategory, setInstrumentCategory] = useState<InstrumentCategory | 'all'>('all');

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
    { id: 'tracks', icon: Sliders, label: 'Saved Tracks' },
    { id: 'rooms', icon: Bookmark, label: 'Saved Rooms' },
    { id: 'appearance', icon: Sun, label: 'Appearance' },
    { id: 'privacy', icon: Shield, label: 'Privacy' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="px-6 sm:px-8 h-16 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </header>

      <div className="flex">
        {/* Fixed Sidebar */}
        <nav className="hidden md:block w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-4rem)] p-6">
          <div className="sticky top-24 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile Tabs */}
        <div className="md:hidden w-full px-4 py-3 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 p-6 sm:p-8 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Information</h2>
                <div className="space-y-4">
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How you want to be called"
                  />
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="w-full h-24 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{bio.length}/500</p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
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
              </motion.div>
            )}

            {activeTab === 'avatar' && (
              <motion.div
                key="avatar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Customize Avatar</h2>
                <AvatarCanvasEditor
                  userId={profile.id}
                  onSave={() => {
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2000);
                  }}
                />
              </div>
              </motion.div>
            )}

            {activeTab === 'instruments' && (
              <motion.div
                key="instruments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Your Instruments</h2>

                {/* Current Instruments */}
                <div className="space-y-3 mb-6">
                  {instruments.length > 0 ? (
                    instruments.map((inst) => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          inst.isPrimary
                            ? 'bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {getInstrumentEmoji(inst.instrumentId)}
                          </span>
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {INSTRUMENTS[inst.instrumentId]?.name || inst.instrumentId}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Level {inst.level} • {Math.round(inst.totalHours)}h played
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.isPrimary ? (
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Primary
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrimaryInstrument(inst.instrumentId)}
                              title="Set as primary"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInstrument(inst.instrumentId)}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove instrument"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
                <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Add Instrument</h3>

                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search instruments..."
                        value={instrumentSearch}
                        onChange={(e) => setInstrumentSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <select
                      value={instrumentCategory}
                      onChange={(e) => setInstrumentCategory(e.target.value as InstrumentCategory | 'all')}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      {Object.entries(INSTRUMENT_CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Instruments Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
                    {Object.entries(INSTRUMENTS)
                      .filter(([id]) => !instruments.find((i) => i.instrumentId === id))
                      .filter(([id, inst]) => {
                        const matchesSearch = instrumentSearch === '' ||
                          inst.name.toLowerCase().includes(instrumentSearch.toLowerCase());
                        const matchesCategory = instrumentCategory === 'all' ||
                          inst.category === instrumentCategory;
                        return matchesSearch && matchesCategory;
                      })
                      .map(([id, inst]) => (
                        <button
                          key={id}
                          onClick={() => handleAddInstrument(id)}
                          className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                        >
                          <InstrumentIcon instrumentId={id} size="md" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{inst.name}</span>
                        </button>
                      ))}
                  </div>

                  {/* Show count */}
                  <p className="text-xs text-gray-500 mt-3">
                    {Object.entries(INSTRUMENTS)
                      .filter(([id]) => !instruments.find((i) => i.instrumentId === id))
                      .filter(([id, inst]) => {
                        const matchesSearch = instrumentSearch === '' ||
                          inst.name.toLowerCase().includes(instrumentSearch.toLowerCase());
                        const matchesCategory = instrumentCategory === 'all' ||
                          inst.category === instrumentCategory;
                        return matchesSearch && matchesCategory;
                      }).length} instruments available
                  </p>
                </div>
              </Card>
              </motion.div>
            )}

            {activeTab === 'tracks' && (
              <motion.div
                key="tracks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <TracksTab userId={profile.id} />
              </motion.div>
            )}

            {activeTab === 'rooms' && (
              <motion.div
                key="rooms"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <SavedRoomsTab />
              </motion.div>
            )}

            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Appearance</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-3">Theme</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          theme === 'light'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          theme === 'light'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          <Sun className="w-6 h-6" />
                        </div>
                        <span className={`text-sm font-medium ${
                          theme === 'light'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          Light
                        </span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          theme === 'dark'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          theme === 'dark'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          <Moon className="w-6 h-6" />
                        </div>
                        <span className={`text-sm font-medium ${
                          theme === 'dark'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          Dark
                        </span>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          theme === 'system'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          theme === 'system'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          <Monitor className="w-6 h-6" />
                        </div>
                        <span className={`text-sm font-medium ${
                          theme === 'system'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          System
                        </span>
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      {theme === 'system'
                        ? 'Automatically switches based on your device settings'
                        : theme === 'light'
                        ? 'Always use light mode'
                        : 'Always use dark mode'}
                    </p>
                  </div>
                </div>
              </Card>
              </motion.div>
            )}

            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Privacy Settings</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Profile Visibility</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['public', 'friends', 'private'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => setProfileVisibility(option)}
                          className={`px-4 py-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                            profileVisibility === option
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
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
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Notification Settings</h2>
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
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
        <p className="text-gray-900 dark:text-white font-medium">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-700'
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

function TracksTab({ userId }: { userId: string }) {
  const { presets, isLoading, loadPresets } = useSavedTracksStore();
  const [showEditor, setShowEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SavedTrackPreset | undefined>();

  useEffect(() => {
    loadPresets(userId);
  }, [userId, loadPresets]);

  const handleEditPreset = (preset: SavedTrackPreset) => {
    setEditingPreset(preset);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingPreset(undefined);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Track Presets</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure your tracks once and bring them into any room
          </p>
        </div>
        <Button onClick={() => setShowEditor(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Preset
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-12">
          <Sliders className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No saved tracks yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Save your track configurations from the DAW and they&apos;ll appear here.
            You can also create a new preset to get started.
          </p>
          <Button onClick={() => setShowEditor(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Preset
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {presets.map((preset) => (
            <SavedTrackCard
              key={preset.id}
              preset={preset}
              onEdit={handleEditPreset}
            />
          ))}
        </div>
      )}

      <SavedTrackEditor
        preset={editingPreset}
        userId={userId}
        isOpen={showEditor}
        onClose={handleCloseEditor}
      />

      {/* Info section */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          How to save tracks
        </h3>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <p>1. Join any room and configure your track (input, effects, volume, etc.)</p>
          <p>2. Click the save icon on your track header in the DAW</p>
          <p>3. Name your preset and select an instrument type</p>
          <p>4. When joining rooms, select which presets to bring with you</p>
        </div>
      </div>
    </Card>
  );
}
