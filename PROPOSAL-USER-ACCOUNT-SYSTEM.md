# OpenStudio User Account System Proposal

## Executive Summary

This proposal outlines a comprehensive user account system for OpenStudio that transforms the platform from an anonymous jam session tool into a **gamified social music collaboration platform**. The system introduces persistent user identities, customizable avatars, progression mechanics, achievements, and social features that encourage engagement and musical growth.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [User Account System](#2-user-account-system)
3. [Avatar & Character System](#3-avatar--character-system)
4. [Instrument System](#4-instrument-system)
5. [Gamification & Progression](#5-gamification--progression)
6. [Statistics & Analytics](#6-statistics--analytics)
7. [Room System Enhancements](#7-room-system-enhancements)
8. [Social Features](#8-social-features)
9. [Admin Panel](#9-admin-panel)
10. [Database Schema](#10-database-schema)
11. [Technical Implementation](#11-technical-implementation)
12. [Phased Rollout](#12-phased-rollout)

---

## 1. Core Philosophy

### Design Principles

1. **Music First**: Gamification enhances the music experience, never distracts from it
2. **Inclusive Progression**: Reward participation and growth, not just skill
3. **Social Bonds**: Features that strengthen connections between musicians
4. **Meaningful Metrics**: Track stats that matter to musicians
5. **Optional Depth**: Simple surface, rich depth for those who want it

### The Player Journey

```
[New User] → [First Jam] → [Find Their Sound] → [Build Reputation] → [Lead Sessions] → [Mentor Others]
    ↓            ↓              ↓                    ↓                   ↓                ↓
  Signup     Tutorial      Unlock Gear          Achievements        Room Master       Legacy Status
```

---

## 2. User Account System

### 2.1 Authentication Methods

| Method | Priority | Notes |
|--------|----------|-------|
| Email/Password | P0 | Core authentication via Supabase Auth |
| Google OAuth | P0 | Most common for quick signup |
| Discord OAuth | P1 | Musicians love Discord |
| Apple Sign-In | P1 | Required for iOS (future) |
| Spotify Connect | P2 | Link music identity |
| Guest Mode | P0 | Try before signup, convert later |

### 2.2 User Profile Structure

```typescript
interface UserProfile {
  // Identity
  id: string;                    // UUID
  username: string;              // Unique, 3-20 chars, alphanumeric + underscores
  displayName: string;           // 1-50 chars, any characters
  email: string;                 // Private, for auth only
  bio: string;                   // Max 500 chars

  // Status
  accountType: 'free' | 'pro' | 'admin';
  verifiedMusician: boolean;     // Blue checkmark for verified artists
  createdAt: Date;
  lastActiveAt: Date;
  isOnline: boolean;

  // Social Links (optional)
  links: {
    spotify?: string;
    soundcloud?: string;
    youtube?: string;
    instagram?: string;
    website?: string;
  };

  // Preferences
  preferences: UserPreferences;

  // Privacy
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showStats: boolean;
    showActivity: boolean;
    allowFriendRequests: boolean;
    allowRoomInvites: boolean;
  };
}

interface UserPreferences {
  // Audio Defaults
  defaultSampleRate: 48000 | 44100;
  defaultBufferSize: 128 | 256 | 512 | 1024;
  autoJitterBuffer: boolean;
  inputDevice?: string;
  outputDevice?: string;

  // UI Preferences
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  compactMode: boolean;
  showTutorialTips: boolean;

  // Notifications
  emailNotifications: boolean;
  soundNotifications: boolean;
  friendRequestNotifications: boolean;
}
```

### 2.3 Guest Mode → Account Conversion

**Guest users can:**
- Join public rooms
- Play for up to 30 minutes per session
- See a preview of what they'd unlock with an account

**Conversion triggers:**
- "Save your progress" prompt after first jam
- "Unlock this achievement" when they earn one
- "Add friends" when they try to friend someone
- Gentle reminder after 3 sessions

**Data preservation:**
- Guest session stats are saved locally
- On signup, guest data merges into new account
- First jam achievements retroactively awarded

---

## 3. Avatar & Character System

### 3.1 Avatar Philosophy

Rather than realistic photos, OpenStudio uses **stylized musician characters** that:
- Feel unique and expressive
- Scale well at small sizes (user cards)
- Support extensive customization
- Create a cohesive visual identity

### 3.2 Avatar Components

```typescript
interface Avatar {
  // Base
  baseStyle: 'human' | 'robot' | 'creature' | 'abstract';
  skinTone: string;              // Hex color or preset

  // Head
  head: {
    shape: 'round' | 'oval' | 'square' | 'heart' | 'triangle';
    hair: HairStyle;
    facialHair?: FacialHairStyle;
    eyes: EyeStyle;
    eyebrows: EyebrowStyle;
    nose: NoseStyle;
    mouth: MouthStyle;
    ears?: EarStyle;
    accessories: HeadAccessory[];  // glasses, piercings, headphones, etc.
  };

  // Body
  body: {
    type: 'slim' | 'average' | 'athletic' | 'large';
    outfit: Outfit;
    accessories: BodyAccessory[];  // necklaces, watches, etc.
  };

  // Expression
  expression: 'neutral' | 'happy' | 'focused' | 'excited' | 'chill';

  // Effects (unlockable)
  effects: {
    aura?: AuraEffect;           // Glowing effects around avatar
    particles?: ParticleEffect;   // Musical notes, stars, etc.
    animation?: AnimationEffect;  // Subtle idle animations
  };

  // Frame (unlockable)
  frame?: AvatarFrame;           // Decorative border

  // Background
  background: {
    type: 'solid' | 'gradient' | 'pattern' | 'animated';
    colors: string[];
    pattern?: string;
  };
}
```

### 3.3 Customization Categories

#### Hair Styles (30+ options)
- Short, medium, long lengths
- Straight, wavy, curly, coily textures
- Classic, modern, punk, artistic styles
- Any color (color picker + presets)

#### Outfits (50+ options)
**Categories:**
- Casual (t-shirts, hoodies, jeans)
- Stage Wear (leather jackets, sequins, bold patterns)
- Genre-Specific (punk, hip-hop, classical, country, EDM)
- Vintage (70s, 80s, 90s styles)
- Futuristic (cyberpunk, space)

**Unlockable Premium Outfits:**
- Band merchandise (fictional bands)
- Genre master outfits (unlock by playing genre)
- Seasonal/event outfits
- Achievement reward outfits

#### Accessories (100+ options)
- Headphones (various styles, colors)
- Glasses/Sunglasses
- Hats (beanies, caps, fedoras, etc.)
- Jewelry (earrings, necklaces, rings)
- Tattoos
- Face paint/makeup

#### Special Effects (Unlockable)
| Effect | Unlock Condition |
|--------|------------------|
| Musical Notes Aura | 100 hours jam time |
| Fire Glow | 50 "Fire" reactions received |
| Electric Sparks | Master an electric instrument |
| Golden Frame | Reach Level 50 |
| Diamond Frame | Reach Level 100 |
| Animated Background | Complete "Dedicated" achievement |
| Custom Particles | Pro subscription |

### 3.4 Avatar Display Contexts

| Context | Size | Details Shown |
|---------|------|---------------|
| User Card (in room) | 48x48px | Head only, expression |
| Chat Message | 32x32px | Head only, minimal |
| Profile Page | 256x256px | Full avatar with effects |
| Leaderboard | 64x64px | Head + outfit top |
| Friend List | 40x40px | Head only |
| Achievement Share | 128x128px | Full avatar + achievement badge |

### 3.5 Avatar Poses (Context-Aware)

The avatar dynamically changes based on activity:

| Activity | Pose/Expression |
|----------|-----------------|
| Idle in room | Neutral, subtle sway |
| Playing instrument | Playing animation for their instrument |
| Speaking (mic active) | Mouth animation |
| Received "fire" reaction | Excited expression, glow effect |
| AFK (5+ min inactive) | Sleepy expression |
| Room Master | Crown/star indicator |
| Muted | Muted icon overlay |

---

## 4. Instrument System

### 4.1 Instrument Identity

Each user has a **primary instrument** that defines their musical identity, plus secondary instruments they can play.

```typescript
interface UserInstruments {
  primary: Instrument;           // Main instrument, shown on profile
  secondary: Instrument[];       // Other instruments they play
  currentlyPlaying?: Instrument; // What they're using this session
}

interface Instrument {
  id: string;
  category: InstrumentCategory;
  name: string;
  icon: string;

  // Customization
  variant?: string;              // e.g., "Stratocaster", "Les Paul"
  finish?: string;               // e.g., "Sunburst", "Black", "Natural"

  // Stats
  hoursPlayed: number;
  sessionsPlayed: number;
  level: number;                 // Instrument-specific level
  xp: number;
}

type InstrumentCategory =
  | 'guitar'      // Electric, Acoustic, Bass, Classical
  | 'keyboard'    // Piano, Synth, Organ, MIDI Controller
  | 'drums'       // Acoustic, Electronic, Percussion
  | 'vocals'      // Lead, Backing, Beatbox, Rap
  | 'strings'     // Violin, Cello, Viola, Double Bass
  | 'wind'        // Saxophone, Trumpet, Flute, Clarinet
  | 'electronic'  // DJ, Producer, Sampler, Looper
  | 'other';      // Harmonica, Ukulele, Banjo, etc.
```

### 4.2 Instrument Progression

Each instrument has its own level (1-100) based on hours played:

| Level | Title | Hours Required | Unlocks |
|-------|-------|----------------|---------|
| 1-10 | Beginner | 0-10 | Basic instrument icon |
| 11-25 | Intermediate | 10-50 | Instrument variants |
| 26-50 | Advanced | 50-150 | Custom finishes |
| 51-75 | Expert | 150-400 | Animated instrument icon |
| 76-99 | Master | 400-1000 | Master badge |
| 100 | Virtuoso | 1000+ | Legendary frame + title |

### 4.3 Instrument Unlockables

**Instrument Skins/Variants:**
- Different models (Stratocaster vs Telecaster vs Les Paul)
- Custom finishes (colors, patterns, materials)
- Signature artist editions (fictional artists)
- Rare/legendary variants (golden, holographic)

**Avatar Integration:**
- Avatar holds/plays their instrument in profile view
- Instrument icon appears next to name in rooms
- Instrument-specific playing animations

### 4.4 Multi-Instrumentalist Features

- **Instrument Slots**: Start with 3, unlock more with levels
- **Quick Switch**: Easy instrument change in room
- **Multi-Instrumentalist Badge**: Play 5+ different instruments
- **Renaissance Musician**: Level 25+ in 5 different categories

---

## 5. Gamification & Progression

### 5.1 Experience Points (XP) System

```typescript
interface XPSystem {
  totalXP: number;
  level: number;                 // 1-100+
  currentLevelXP: number;        // XP in current level
  nextLevelXP: number;           // XP needed for next level

  // XP breakdown by category
  categories: {
    jamming: number;             // Time spent in rooms
    social: number;              // Friends, reactions, chat
    creation: number;            // Uploading tracks, AI generation
    mastery: number;             // Completing achievements
    mentorship: number;          // Helping new users
  };
}
```

### 5.2 XP Earning Activities

| Activity | XP Earned | Cooldown/Limit |
|----------|-----------|----------------|
| **Jamming** | | |
| Join a room | +10 XP | Once per room/day |
| Complete 10 min jam session | +25 XP | Every 10 min |
| Complete 30 min jam session | +50 XP bonus | Per session |
| Complete 1 hour jam session | +100 XP bonus | Per session |
| Play with new person | +15 XP | Per unique user/day |
| | | |
| **Social** | | |
| Send first message in room | +5 XP | Per room |
| Receive "Fire" reaction | +10 XP | Max 50/day |
| Give reaction | +2 XP | Max 20/day |
| Add friend | +20 XP | Per friend |
| Invite friend to room | +15 XP | Max 5/day |
| | | |
| **Creation** | | |
| Upload backing track | +30 XP | Max 10/day |
| Generate AI track | +20 XP | Max 5/day |
| Create room | +10 XP | Max 3/day |
| | | |
| **Mastery** | | |
| Unlock achievement | +50-500 XP | Per achievement |
| Complete daily challenge | +100 XP | Daily |
| Complete weekly challenge | +500 XP | Weekly |
| | | |
| **Mentorship** | | |
| Jam with new user (<5 sessions) | +25 XP | Per new user |
| New user you invited levels up | +50 XP | Per level (first 10) |

### 5.3 Level Progression

**Level Formula:** `Level = floor(sqrt(totalXP / 100))`

| Level Range | Title | Perks Unlocked |
|-------------|-------|----------------|
| 1-5 | Newcomer | Basic features |
| 6-10 | Rookie | Custom avatar backgrounds |
| 11-20 | Regular | Create private rooms |
| 21-30 | Enthusiast | Extended room duration (2hr) |
| 31-40 | Dedicated | Custom room themes |
| 41-50 | Veteran | Priority matchmaking |
| 51-60 | Expert | Beta feature access |
| 61-75 | Elite | Exclusive avatar frames |
| 76-90 | Master | Custom profile badges |
| 91-99 | Grandmaster | Legacy status |
| 100+ | Legend | Everything + yearly recognition |

### 5.4 Achievement System

#### Achievement Categories

**1. Getting Started (Tutorial)**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| First Note | Join your first room | 50 |
| Sound Check | Test your audio | 25 |
| Hello World | Send your first chat message | 25 |
| Finding Your Voice | Set your primary instrument | 50 |
| Looking Good | Customize your avatar | 50 |

**2. Jam Session (Quantity)**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| First Jam | Complete 1 jam session | 50 |
| Getting Warmed Up | Complete 10 jam sessions | 100 |
| Regular Player | Complete 50 jam sessions | 200 |
| Dedicated Musician | Complete 100 jam sessions | 300 |
| Session Warrior | Complete 500 jam sessions | 500 |
| Living Legend | Complete 1000 jam sessions | 1000 |

**3. Time Investment**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| Hour One | 1 hour total jam time | 50 |
| Night Owl | 10 hours total jam time | 100 |
| Committed | 50 hours total jam time | 200 |
| Passionate | 100 hours total jam time | 300 |
| Obsessed | 500 hours total jam time | 500 |
| Lifetime Musician | 1000 hours total jam time | 1000 |

**4. Social Butterfly**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| First Friend | Add 1 friend | 50 |
| Making Connections | Add 10 friends | 100 |
| Popular | Add 50 friends | 200 |
| Influencer | Add 100 friends | 300 |
| Network | Jam with 100 unique users | 300 |
| Community Pillar | Jam with 500 unique users | 500 |

**5. Room Master**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| Room Creator | Create your first room | 50 |
| Host with the Most | Host 10 sessions | 100 |
| Party Starter | Have 5+ people in your room | 150 |
| Full House | Have 10 people in your room | 300 |
| Regular Venue | Host 100 sessions | 300 |
| Legendary Venue | Host 500 sessions | 500 |

**6. Instrument Mastery**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| Dedicated Player | Reach Level 25 on any instrument | 150 |
| Instrument Master | Reach Level 50 on any instrument | 300 |
| Virtuoso | Reach Level 100 on any instrument | 500 |
| Multi-Instrumentalist | Level 25+ on 3 instruments | 300 |
| Renaissance Musician | Level 25+ on 5 instruments | 500 |
| Master of All | Level 50+ on 5 instruments | 1000 |

**7. Genre Explorer**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| Rock On | 10 hours in Rock rooms | 100 |
| Jazz Hands | 10 hours in Jazz rooms | 100 |
| Electronic Soul | 10 hours in Electronic rooms | 100 |
| Genre Hopper | 5+ hours in 5 different genres | 200 |
| Musical Polyglot | 10+ hours in 10 different genres | 500 |

**8. Creation & Contribution**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| DJ Mode | Upload your first track | 50 |
| Track Collector | Upload 10 tracks | 100 |
| AI Collaborator | Generate first AI track | 50 |
| AI Producer | Generate 50 AI tracks | 200 |
| Stem Master | Separate 10 tracks into stems | 100 |

**9. Special & Hidden**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| Night Jammer | Jam between 12am-4am | 100 |
| Early Bird | Jam between 5am-7am | 100 |
| Marathon Session | Single session over 3 hours | 200 |
| Global Jam | Jam with users from 5+ countries | 200 |
| Perfect Timing | 0ms latency (briefly) | 150 |
| Founding Member | Account created in 2024/2025 | 500 |
| Beta Tester | Participated in beta | 300 |

**10. Streak Achievements**
| Achievement | Requirement | XP |
|-------------|-------------|-----|
| On Fire | 7 day streak | 150 |
| Consistent | 30 day streak | 300 |
| Dedicated | 100 day streak | 500 |
| Unstoppable | 365 day streak | 1000 |

### 5.5 Daily & Weekly Challenges

**Daily Challenges (pick 3 random each day):**
- Jam for 30 minutes
- Play with 3 different people
- Send 10 chat messages
- Give 5 reactions
- Try a new instrument
- Host a room
- Jam in a genre you haven't tried this week

**Weekly Challenges (larger goals):**
- Total 5 hours jam time
- Jam with 10 unique users
- Complete 10 jam sessions
- Earn 500 XP
- Upload 3 tracks

**Rewards:**
- Daily: 100 XP + streak bonus
- Weekly: 500 XP + random cosmetic item

### 5.6 Streaks

```typescript
interface Streaks {
  currentDailyStreak: number;    // Days in a row with activity
  longestDailyStreak: number;    // Personal best
  currentWeeklyStreak: number;   // Weeks in a row completing weekly challenge

  // Streak protection
  freezesAvailable: number;      // Can skip 1 day without breaking streak
  lastActiveDate: Date;
}
```

**Streak Bonuses:**
- 7 days: +10% XP for the day
- 30 days: +25% XP, exclusive avatar item
- 100 days: +50% XP, exclusive title
- 365 days: Legendary status, permanent +25% XP

### 5.7 Reputation System

Beyond XP, users earn **Reputation** based on how others perceive them:

```typescript
interface Reputation {
  overall: number;               // 0-5 stars (calculated)

  categories: {
    skill: number;               // Musical ability
    vibe: number;                // Fun to play with
    reliability: number;         // Shows up, good connection
    helpfulness: number;         // Helps others, mentors
  };

  totalRatings: number;
  recentRatings: Rating[];       // Last 50 ratings
}
```

**After each session, users can optionally rate others:**
- Quick: 1-5 stars overall
- Detailed: Rate each category

**Reputation Benefits:**
- High rep users appear first in public room listings
- "Trusted Musician" badge at 4.5+ stars (50+ ratings)
- Priority for collaborative features

---

## 6. Statistics & Analytics

### 6.1 User Statistics Dashboard

```typescript
interface UserStats {
  // Time Stats
  totalJamTime: Duration;
  averageSessionLength: Duration;
  longestSession: Duration;

  // Session Stats
  totalSessions: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;

  // Social Stats
  uniqueCollaborators: number;
  totalReactionsReceived: number;
  totalReactionsGiven: number;
  messagesSent: number;
  friendCount: number;

  // Room Stats
  roomsCreated: number;
  roomsJoined: number;
  averageRoomSize: number;

  // Contribution Stats
  tracksUploaded: number;
  tracksGenerated: number;
  stemsSeparated: number;

  // Activity Heatmap
  activityByHour: number[];      // 24 values
  activityByDay: number[];       // 7 values

  // Trends
  weeklyTrend: TrendData[];
  monthlyTrend: TrendData[];
}
```

### 6.2 Instrument Statistics

```typescript
interface InstrumentStats {
  instrument: Instrument;

  // Usage
  totalHours: number;
  totalSessions: number;

  // Progress
  level: number;
  xpToNextLevel: number;

  // Activity
  lastPlayed: Date;
  favoriteGenres: Genre[];

  // Milestones
  achievementsUnlocked: Achievement[];
}
```

### 6.3 Visual Statistics (Profile Page)

**Charts & Visualizations:**
1. **Activity Heatmap**: GitHub-style contribution grid
2. **Instrument Breakdown**: Pie chart of time by instrument
3. **Genre Radar**: Radar chart of genre preferences
4. **Progress Graph**: XP/Level over time
5. **Collaboration Network**: Visual map of frequent collaborators

### 6.4 Wrapped/Year in Review

**Annual "OpenStudio Wrapped" featuring:**
- Total hours jammed
- Favorite instrument & genre
- Top collaborators
- Achievements earned
- "Your sound" personality type
- Shareable social cards

---

## 7. Room System Enhancements

### 7.1 Room Types

```typescript
type RoomType =
  | 'public'      // Anyone can join, listed in lobby
  | 'private'     // Invite/link only
  | 'friends'     // Only friends can join
  | 'scheduled'   // Future room with RSVP
  | 'recurring';  // Weekly jam sessions

interface Room {
  id: string;
  code: string;                  // 8-char join code
  name: string;
  description?: string;
  type: RoomType;

  // Ownership
  owner: User;
  moderators: User[];

  // Settings
  maxUsers: number;              // 2-20
  genre?: Genre;
  skill?: 'beginner' | 'intermediate' | 'advanced' | 'any';

  // Requirements
  minLevel?: number;
  minReputation?: number;

  // Audio Settings
  settings: RoomSettings;

  // State
  currentUsers: User[];
  currentTrack?: Track;

  // Metadata
  createdAt: Date;
  scheduledFor?: Date;
  tags: string[];
}
```

### 7.2 Room Customization

**Room Themes (visual):**
- Default (dark)
- Recording Studio
- Concert Stage
- Cozy Lounge
- Neon Arcade
- Nature (forest, beach)
- Space Station
- Custom (Pro feature)

**Room Features:**
- Custom room banner image
- **Rich Markdown Description** (see 7.2.1)
- Room rules/description
- Required instruments
- Skill level recommendation
- Genre tags
- Welcome message

#### 7.2.1 Markdown Room Descriptions

Room owners can create rich, formatted descriptions using **Markdown**:

**Supported Markdown Features:**
- Headers (`# H1`, `## H2`, `### H3`)
- Bold, italic, strikethrough (`**bold**`, `*italic*`, `~~strike~~`)
- Lists (ordered and unordered)
- Links `[text](url)`
- Code blocks (for sharing tuning, chord progressions, etc.)
- Blockquotes (for featured quotes/rules)
- Horizontal rules (`---`)
- Emoji support 🎸🎹🥁

**Display Locations:**
| Location | Display Mode |
|----------|-------------|
| Room Card (Lobby) | Truncated preview (first 150 chars, plain text) |
| Room Info Panel | Full rendered markdown |
| Room Join Modal | Full rendered markdown with scroll |
| Room Header | Collapsible full description |

**Example Room Description:**

```markdown
# 🎸 Late Night Blues Jam

Welcome to the **Late Night Blues Jam**! This is a chill space for
blues lovers of all skill levels.

## What We Play
- Chicago Blues
- Delta Blues
- Blues Rock
- Slow jams and ballads

## House Rules
> Be respectful, have fun, and let the music flow!

1. **No** heavy distortion - keep it clean and warm
2. Take turns on solos - share the spotlight
3. Communicate in chat before starting a new song

## Typical Session
We usually work through standards like:
- `Sweet Home Chicago` (Key of E)
- `The Thrill is Gone` (Bm)
- `Stormy Monday` (G)

---

*Host: @BluesGuyMike* | *Est. 2024*
```

**UI Implementation:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎸 Late Night Blues Jam                    [⚙️] [👥 5/10]  │
├─────────────────────────────────────────────────────────────┤
│ ▼ Room Description                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  🎸 Late Night Blues Jam                               │ │
│ │  ═══════════════════════                               │ │
│ │                                                         │ │
│ │  Welcome to the Late Night Blues Jam! This is a chill  │ │
│ │  space for blues lovers of all skill levels.           │ │
│ │                                                         │ │
│ │  What We Play                                          │ │
│ │  ────────────                                          │ │
│ │  • Chicago Blues                                        │ │
│ │  • Delta Blues                                          │ │
│ │  • Blues Rock                                           │ │
│ │  ...                                                    │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [▲ Collapse]                                                │
└─────────────────────────────────────────────────────────────┘
```

**Security Considerations:**
- Sanitize all markdown to prevent XSS
- Disable raw HTML in markdown
- Limit description length (max 5000 characters)
- Rate limit updates to prevent spam
- Use a library like `react-markdown` with `rehype-sanitize`

### 7.3 Persistent Rooms

**Saved Room Configurations:**
```typescript
interface SavedRoom {
  id: string;
  name: string;
  owner: User;

  // Configuration
  config: RoomConfig;

  // Statistics
  totalSessions: number;
  totalUniqueVisitors: number;
  averageSessionLength: Duration;

  // Regulars
  regulars: User[];              // Frequent visitors

  // History
  recentSessions: SessionSummary[];
}
```

**Users can:**
- Save room configurations
- Make rooms "permanent" (always accessible at same URL)
- See room history and stats
- Set up recurring sessions
- Build a "regular" community

### 7.4 Room Discovery

**Public Room Lobby:**
- Filter by genre, skill level, instrument needed
- Sort by: active users, recently created, most popular
- Show room vibe (based on recent reactions)
- Quick preview (see who's in room)

**Matchmaking:**
- "Quick Join" - finds best room based on profile
- "Looking for Group" - queue for specific needs
- "Jam with Friends" - see friends' active rooms

### 7.5 Room Moderation

**Room Owner Powers:**
- Kick/ban users
- Mute users
- Transfer ownership
- Assign moderators
- Set room rules
- Enable/disable features (AI, uploads, etc.)

**Moderator Powers:**
- Mute users
- Kick users
- Manage queue

---

## 8. Social Features

### 8.1 Friends System

```typescript
interface FriendSystem {
  friends: Friend[];
  pending: FriendRequest[];
  blocked: User[];

  // Discovery
  suggested: User[];             // Based on jam history
  recentlyPlayed: User[];        // Last 50 collaborators
}

interface Friend {
  user: User;
  friendsSince: Date;
  nickname?: string;             // Private nickname

  // Stats
  jamsToogether: number;
  totalTimeToogether: Duration;
  favoriteRoom?: SavedRoom;
}
```

**Friend Features:**
- See friends' online status
- See what room friends are in
- Quick invite to current room
- Notification when friend comes online
- Friend activity feed

### 8.2 Following System (One-way)

For public figures / skilled musicians:
- Follow without mutual friendship
- See when they're jamming publicly
- Get notified of scheduled sessions
- Follow count on profile

### 8.3 Reactions & Kudos

**In-Room Reactions:**
| Reaction | Meaning | Visual |
|----------|---------|--------|
| 🔥 Fire | That was awesome! | Flames around avatar |
| 👏 Clap | Good job | Clapping animation |
| 🎸 Shred | Great playing | Guitar sparks |
| ❤️ Love | Love this vibe | Hearts floating |
| 🤯 Mind Blown | Impressive | Explosion effect |
| ✨ Magic | Beautiful moment | Sparkles |

**Post-Session Kudos:**
- "Best Solo" - highlight a moment
- "Great Vibes" - fun to play with
- "Tight Groove" - excellent rhythm
- "Smooth Keys" - (instrument specific)

### 8.4 Activity Feed

**Your feed shows:**
- Friends' achievements
- Friends starting jam sessions
- New followers/friends
- Weekly highlights from people you follow

### 8.5 Messaging

**Direct Messages:**
- Text chat between friends
- Room invites
- Track sharing
- No strangers (friends only, or following + allowlist)

---

## 9. Admin Panel

### 9.1 Admin Dashboard Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  OPENSTUDIO ADMIN PANEL                              [Admin: You]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Active Users │  │ Active Rooms │  │ Total Users  │           │
│  │     127      │  │      34      │  │   12,847     │           │
│  │    ↑ 12%     │  │    ↑ 5%      │  │   ↑ 234/wk   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Jam Hours    │  │ Tracks       │  │ AI Gens      │           │
│  │  Today: 89   │  │    8,234     │  │   Today: 156  │           │
│  │  Week: 1,247 │  │   ↑ 89/wk    │  │   Week: 892   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  [Real-Time Activity Graph - Last 24 Hours]                      │
│  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▁▂▃▅▆▇▇▆▅▄▃▂                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Admin Sections

#### 9.2.1 User Management

**User List:**
- Search by username, email, ID
- Filter by: account type, status, level, creation date
- Sort by: activity, level, reports

**User Detail View:**
- Full profile information
- Account history
- Session logs
- Reports against user
- Admin actions taken

**Admin Actions:**
| Action | Description |
|--------|-------------|
| View Profile | See full user details |
| Edit User | Modify username, email, type |
| Reset Password | Force password reset |
| Suspend | Temporary ban (1 day, 7 days, 30 days) |
| Ban | Permanent ban |
| Unban | Remove ban |
| Grant Pro | Give Pro subscription |
| Verify | Add verified badge |
| Add XP/Level | Manual XP adjustment |
| Add Achievement | Grant achievement |
| Impersonate | View site as user (for debugging) |

#### 9.2.2 Room Management

**Active Rooms:**
- Real-time list of all rooms
- User count, duration, type
- Quick actions: join, close, message

**Room Actions:**
| Action | Description |
|--------|-------------|
| Join as Admin | Enter room with admin badge |
| Broadcast Message | Send system message to room |
| Kick User | Remove user from room |
| Close Room | Force close room |
| Transfer Ownership | Change room owner |

#### 9.2.3 Content Moderation

**Reports Queue:**
- User reports (harassment, spam, abuse)
- Automated flags (profanity, suspicious behavior)
- Priority based on severity

**Content Review:**
- Uploaded tracks (for copyright issues)
- AI generated content
- User avatars/profile images
- Chat logs (when reported)

**Moderation Actions:**
| Action | Description |
|--------|-------------|
| Dismiss | False report, no action |
| Warn | Send warning to user |
| Remove Content | Delete offending content |
| Suspend | Temporary ban |
| Ban | Permanent ban |
| Escalate | Flag for higher review |

#### 9.2.4 Analytics Dashboard

**Key Metrics:**
- DAU/WAU/MAU (Daily/Weekly/Monthly Active Users)
- Retention rates (D1, D7, D30)
- Session metrics (length, frequency)
- Conversion rate (guest → signup)
- Feature usage breakdown

**Charts:**
- User growth over time
- Activity by time of day/week
- Geographic distribution
- Instrument/genre popularity
- Achievement unlock rates

**Exportable Reports:**
- CSV export of any data
- Scheduled email reports
- Custom date ranges

#### 9.2.5 System Configuration

**Feature Flags:**
- Toggle features on/off
- A/B testing configuration
- Beta feature rollout percentage

**XP/Level Tuning:**
- Adjust XP values for activities
- Modify level curve
- Achievement requirements

**Limits & Quotas:**
- Guest session limits
- Upload limits
- AI generation limits
- Rate limiting configuration

#### 9.2.6 Announcements & Communication

**System Announcements:**
- Banner messages (shown to all users)
- In-app notifications
- Email campaigns

**Scheduled Messages:**
- Maintenance notices
- Feature announcements
- Event promotions

### 9.3 Admin Audit Log

All admin actions are logged:
```typescript
interface AdminAuditLog {
  id: string;
  adminUser: User;
  action: string;
  target: User | Room | Content;
  details: object;
  timestamp: Date;
  ipAddress: string;
}
```

### 9.4 Admin Roles

| Role | Permissions |
|------|-------------|
| Super Admin | Everything, including other admin management |
| Admin | User management, moderation, analytics |
| Moderator | Content moderation, user warnings |
| Support | View-only access, basic user actions |

---

## 10. Database Schema

### 10.1 New Tables

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  bio TEXT,

  -- Type & Status
  account_type VARCHAR(20) DEFAULT 'free',
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  ban_expires_at TIMESTAMPTZ,

  -- Progression
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,

  -- Streaks
  current_daily_streak INTEGER DEFAULT 0,
  longest_daily_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  streak_freezes INTEGER DEFAULT 0,

  -- Social Links
  link_spotify VARCHAR(255),
  link_soundcloud VARCHAR(255),
  link_youtube VARCHAR(255),
  link_instagram VARCHAR(255),
  link_website VARCHAR(255),

  -- Privacy Settings
  profile_visibility VARCHAR(20) DEFAULT 'public',
  show_stats BOOLEAN DEFAULT TRUE,
  show_activity BOOLEAN DEFAULT TRUE,
  allow_friend_requests BOOLEAN DEFAULT TRUE,
  allow_room_invites BOOLEAN DEFAULT TRUE,

  -- Preferences (JSON)
  preferences JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_online_at TIMESTAMPTZ
);

-- User Avatars
CREATE TABLE user_avatars (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  avatar_data JSONB NOT NULL,  -- Full avatar configuration
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Instruments
CREATE TABLE user_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  instrument_id VARCHAR(50) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,

  -- Customization
  variant VARCHAR(50),
  finish VARCHAR(50),

  -- Stats
  total_hours DECIMAL(10,2) DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_played_at TIMESTAMPTZ,

  UNIQUE(user_id, instrument_id)
);

-- User Stats (aggregated, updated periodically)
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),

  -- Time Stats
  total_jam_seconds BIGINT DEFAULT 0,
  average_session_seconds INTEGER DEFAULT 0,
  longest_session_seconds INTEGER DEFAULT 0,

  -- Session Stats
  total_sessions INTEGER DEFAULT 0,
  sessions_this_week INTEGER DEFAULT 0,
  sessions_this_month INTEGER DEFAULT 0,

  -- Social Stats
  unique_collaborators INTEGER DEFAULT 0,
  reactions_received INTEGER DEFAULT 0,
  reactions_given INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,

  -- Room Stats
  rooms_created INTEGER DEFAULT 0,
  rooms_joined INTEGER DEFAULT 0,

  -- Contribution Stats
  tracks_uploaded INTEGER DEFAULT 0,
  tracks_generated INTEGER DEFAULT 0,
  stems_separated INTEGER DEFAULT 0,

  -- Activity Patterns (JSON arrays)
  activity_by_hour JSONB DEFAULT '[]',
  activity_by_day JSONB DEFAULT '[]',

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements Definition
CREATE TABLE achievements (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  xp_reward INTEGER DEFAULT 50,

  -- Unlock Criteria (JSON)
  criteria JSONB NOT NULL,

  -- Display
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- User Achievements (unlocked)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  achievement_id VARCHAR(50) REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, achievement_id)
);

-- Friends
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  friend_id UUID REFERENCES user_profiles(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked

  -- Metadata
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Stats
  jams_together INTEGER DEFAULT 0,
  total_time_together_seconds BIGINT DEFAULT 0,

  UNIQUE(user_id, friend_id)
);

-- Follows (one-way)
CREATE TABLE follows (
  follower_id UUID REFERENCES user_profiles(id),
  following_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (follower_id, following_id)
);

-- Reputation/Ratings
CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID REFERENCES user_profiles(id),
  rated_id UUID REFERENCES user_profiles(id),
  session_id UUID,

  -- Ratings (1-5)
  overall INTEGER CHECK (overall >= 1 AND overall <= 5),
  skill INTEGER CHECK (skill >= 1 AND skill <= 5),
  vibe INTEGER CHECK (vibe >= 1 AND vibe <= 5),
  reliability INTEGER CHECK (reliability >= 1 AND reliability <= 5),
  helpfulness INTEGER CHECK (helpfulness >= 1 AND helpfulness <= 5),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session History
CREATE TABLE session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  room_id VARCHAR(20),

  -- Session Data
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Context
  instrument_id VARCHAR(50),
  was_room_master BOOLEAN DEFAULT FALSE,

  -- Participants (snapshot)
  participant_ids UUID[]
);

-- Saved Rooms (persistent room configs)
CREATE TABLE saved_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES user_profiles(id),

  -- Room Config
  code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  room_type VARCHAR(20) DEFAULT 'private',
  max_users INTEGER DEFAULT 10,
  genre VARCHAR(50),
  skill_level VARCHAR(20),
  min_level INTEGER,
  min_reputation DECIMAL(3,2),

  -- Customization
  theme VARCHAR(50) DEFAULT 'default',
  banner_url VARCHAR(255),
  welcome_message TEXT,
  rules TEXT,

  -- Settings (JSON)
  settings JSONB DEFAULT '{}',

  -- Stats
  total_sessions INTEGER DEFAULT 0,
  total_unique_visitors INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Room Moderators
CREATE TABLE room_moderators (
  room_id UUID REFERENCES saved_rooms(id),
  user_id UUID REFERENCES user_profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES user_profiles(id),

  PRIMARY KEY (room_id, user_id)
);

-- Daily/Weekly Challenges
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL, -- daily, weekly
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,

  -- Criteria (JSON)
  criteria JSONB NOT NULL,

  -- Reward
  xp_reward INTEGER DEFAULT 100,

  -- Active Period
  active_from DATE NOT NULL,
  active_until DATE NOT NULL
);

-- User Challenge Progress
CREATE TABLE user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  challenge_id UUID REFERENCES challenges(id),

  -- Progress
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  UNIQUE(user_id, challenge_id)
);

-- Reports (for moderation)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES user_profiles(id),

  -- Target
  target_type VARCHAR(20) NOT NULL, -- user, room, content
  target_id UUID NOT NULL,

  -- Report Details
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  evidence_urls TEXT[],

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, resolved, dismissed
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  action_taken VARCHAR(50),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Audit Log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(id),

  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id UUID,

  details JSONB,
  ip_address INET,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avatar Unlockables
CREATE TABLE avatar_items (
  id VARCHAR(50) PRIMARY KEY,
  category VARCHAR(50) NOT NULL, -- hair, outfit, accessory, effect, frame
  name VARCHAR(100) NOT NULL,

  -- Unlock Criteria
  unlock_type VARCHAR(20) DEFAULT 'free', -- free, level, achievement, purchase
  unlock_requirement JSONB,

  -- Display
  preview_url VARCHAR(255),
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Unlocked Items
CREATE TABLE user_avatar_items (
  user_id UUID REFERENCES user_profiles(id),
  item_id VARCHAR(50) REFERENCES avatar_items(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, item_id)
);

-- Direct Messages
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES user_profiles(id),
  recipient_id UUID REFERENCES user_profiles(id),

  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP Transactions (for debugging/auditing)
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),

  amount INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  source_type VARCHAR(50), -- session, achievement, challenge, admin
  source_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.2 Key Indexes

```sql
-- User lookups
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_level ON user_profiles(level);
CREATE INDEX idx_user_profiles_last_online ON user_profiles(last_online_at);

-- Friends
CREATE INDEX idx_friendships_user ON friendships(user_id, status);
CREATE INDEX idx_friendships_friend ON friendships(friend_id, status);

-- Sessions
CREATE INDEX idx_session_history_user ON session_history(user_id, joined_at DESC);
CREATE INDEX idx_session_history_room ON session_history(room_id);

-- Achievements
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- Moderation
CREATE INDEX idx_reports_status ON reports(status, created_at);
```

---

## 11. Technical Implementation

### 11.1 Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [Landing Page]                                               │
│       │                                                       │
│       ├── "Sign Up" ──→ [Sign Up Modal]                      │
│       │                      │                                │
│       │                      ├── Email/Password               │
│       │                      ├── Google OAuth                 │
│       │                      └── Discord OAuth                │
│       │                             │                         │
│       │                             ↓                         │
│       │                    [Supabase Auth]                    │
│       │                             │                         │
│       │                             ↓                         │
│       │                    [Create Profile]                   │
│       │                      - Username                       │
│       │                      - Display Name                   │
│       │                      - Primary Instrument             │
│       │                      - Avatar (basic)                 │
│       │                             │                         │
│       │                             ↓                         │
│       │                    [Tutorial/Onboarding]              │
│       │                             │                         │
│       ├── "Log In" ──→ [Log In Modal] ──→ [Supabase Auth]    │
│       │                                           │           │
│       │                                           ↓           │
│       └── "Try as Guest" ──→ [Guest Session] ──→ [Room]      │
│                                    │                          │
│                                    ↓                          │
│                           [Conversion Prompt]                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 State Management

**New Zustand Stores:**

```typescript
// useAuthStore - Authentication state
interface AuthStore {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// useProgressStore - XP, Level, Achievements
interface ProgressStore {
  xp: number;
  level: number;
  achievements: Achievement[];
  unlockedAchievements: string[];

  // Actions
  addXP: (amount: number, reason: string) => void;
  checkAchievements: () => void;
  unlockAchievement: (id: string) => void;
}

// useSocialStore - Friends, Activity
interface SocialStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  onlineFriends: string[];
  activityFeed: ActivityItem[];

  // Actions
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}
```

### 11.3 New Components

```
/src/components/
├── auth/
│   ├── SignUpModal.tsx
│   ├── LoginModal.tsx
│   ├── AuthProvider.tsx
│   └── ProtectedRoute.tsx
│
├── profile/
│   ├── ProfilePage.tsx
│   ├── ProfileHeader.tsx
│   ├── ProfileStats.tsx
│   ├── AchievementGrid.tsx
│   ├── InstrumentList.tsx
│   └── ActivityHeatmap.tsx
│
├── avatar/
│   ├── AvatarEditor.tsx
│   ├── AvatarPreview.tsx
│   ├── AvatarCategory.tsx
│   └── AvatarItem.tsx
│
├── gamification/
│   ├── XPBar.tsx
│   ├── LevelBadge.tsx
│   ├── AchievementCard.tsx
│   ├── AchievementUnlock.tsx (modal)
│   ├── DailyChallenge.tsx
│   ├── StreakIndicator.tsx
│   └── ReputationStars.tsx
│
├── social/
│   ├── FriendsList.tsx
│   ├── FriendCard.tsx
│   ├── FriendRequest.tsx
│   ├── ActivityFeed.tsx
│   ├── DirectMessages.tsx
│   └── UserSearch.tsx
│
├── room/
│   ├── RoomLobby.tsx
│   ├── RoomCard.tsx
│   ├── RoomFilters.tsx
│   ├── RoomSettings.tsx (enhanced)
│   └── RoomHistory.tsx
│
└── admin/
    ├── AdminLayout.tsx
    ├── AdminDashboard.tsx
    ├── UserManagement.tsx
    ├── RoomManagement.tsx
    ├── ContentModeration.tsx
    ├── Analytics.tsx
    └── SystemConfig.tsx
```

### 11.4 API Routes

```
/src/app/api/
├── auth/
│   ├── signup/route.ts
│   ├── login/route.ts
│   └── logout/route.ts
│
├── users/
│   ├── route.ts                    # List users (admin)
│   ├── [userId]/
│   │   ├── route.ts                # Get/Update user
│   │   ├── stats/route.ts          # Get user stats
│   │   ├── achievements/route.ts   # Get achievements
│   │   ├── instruments/route.ts    # Get/Update instruments
│   │   └── avatar/route.ts         # Get/Update avatar
│   ├── me/
│   │   ├── route.ts                # Current user profile
│   │   └── preferences/route.ts    # User preferences
│   └── search/route.ts             # Search users
│
├── friends/
│   ├── route.ts                    # List friends
│   ├── requests/route.ts           # Friend requests
│   └── [friendId]/route.ts         # Friend actions
│
├── achievements/
│   ├── route.ts                    # List all achievements
│   └── check/route.ts              # Check for new unlocks
│
├── challenges/
│   ├── route.ts                    # Get current challenges
│   └── progress/route.ts           # Update progress
│
├── rooms/
│   ├── saved/route.ts              # Saved room configs
│   ├── lobby/route.ts              # Public room listing
│   └── history/route.ts            # User's room history
│
└── admin/
    ├── dashboard/route.ts          # Dashboard stats
    ├── users/route.ts              # User management
    ├── reports/route.ts            # Moderation queue
    ├── audit/route.ts              # Audit log
    └── config/route.ts             # System config
```

---

## 12. Phased Rollout

### Phase 1: Foundation (Weeks 1-3)
**Goal: Basic account system working**

- [ ] Supabase Auth integration
- [ ] User profile creation flow
- [ ] Basic profile page
- [ ] Username system
- [ ] Link existing room system to accounts
- [ ] Guest mode with conversion prompt

**Deliverables:**
- Users can sign up, log in, log out
- Profiles persist across sessions
- Room history tracked

### Phase 2: Identity (Weeks 4-6)
**Goal: Users have unique identities**

- [ ] Avatar editor (basic customization)
- [ ] Instrument selection and tracking
- [ ] Basic stats dashboard
- [ ] Profile visibility settings
- [ ] User preferences storage

**Deliverables:**
- Full avatar customization
- Instrument progression tracking
- Stats visible on profile

### Phase 3: Gamification (Weeks 7-10)
**Goal: Progression systems active**

- [ ] XP system implementation
- [ ] Level progression
- [ ] Achievement system (core achievements)
- [ ] Daily/weekly challenges
- [ ] Streak tracking
- [ ] XP notifications and celebrations

**Deliverables:**
- Users earn XP from activities
- Level displayed on profile
- Achievements unlockable
- Daily challenges available

### Phase 4: Social (Weeks 11-14)
**Goal: Users can connect**

- [ ] Friends system
- [ ] Friend activity feed
- [ ] Online status
- [ ] Room invites
- [ ] Following system
- [ ] In-room reactions (enhanced)
- [ ] Post-session ratings

**Deliverables:**
- Full friends functionality
- Activity feed active
- Reputation system working

### Phase 5: Rooms & Discovery (Weeks 15-17)
**Goal: Enhanced room experience**

- [ ] Room lobby/discovery
- [ ] Saved room configurations
- [ ] Room customization (themes, banners)
- [ ] Matchmaking
- [ ] Room moderation tools

**Deliverables:**
- Public room browsing
- Persistent rooms
- Room themes

### Phase 6: Admin & Polish (Weeks 18-20)
**Goal: Platform management ready**

- [ ] Admin dashboard
- [ ] User management
- [ ] Content moderation
- [ ] Analytics
- [ ] Audit logging
- [ ] Final polish and bug fixes

**Deliverables:**
- Full admin panel
- Moderation tools
- Analytics dashboard

---

## Success Metrics

### Engagement
- **DAU/MAU Ratio** > 20%
- **Average Session Length** > 30 minutes
- **Sessions per User per Week** > 3

### Retention
- **D1 Retention** > 40%
- **D7 Retention** > 25%
- **D30 Retention** > 15%

### Social
- **Friend Connections per User** > 5
- **% Users with Friends** > 50%
- **Rooms with 2+ Users** > 70%

### Gamification
- **% Users with Achievements** > 80%
- **% Users on Daily Streak** > 30%
- **Weekly Challenge Completion** > 25%

---

## Open Questions for Discussion

1. **Monetization**: Should there be a Pro tier? What features are premium?
2. **Avatar Art Style**: Illustrated characters vs pixel art vs 3D avatars?
3. **Moderation**: Automated profanity filter? Report-only? Proactive scanning?
4. **Matchmaking Scope**: Smart matchmaking by skill/genre, or just room discovery?
5. **Mobile App**: Is mobile a future consideration? (Affects auth choices)
6. **Data Privacy**: GDPR compliance requirements? Data export?
7. **API Access**: Public API for integrations? Webhooks?

---

*This proposal is a living document. Feedback and iteration expected.*
