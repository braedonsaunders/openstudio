# OpenStudio

A browser-based, ultra-low latency jamming studio with integrated backing track management.

## Features

### Core Functionality
- **Sub-30ms Latency**: Ultra-low latency audio streaming powered by Cloudflare's global edge network and WebRTC
- **Adaptive Jitter Buffer**: Intelligent buffer sizing that automatically adjusts to network conditions (128-1024 samples)
- **SFU Architecture**: Selective Forwarding Unit means you upload once, and everyone receives - no mesh network bottlenecks
- **Global Edge Network**: Rooms are hosted at the nearest Cloudflare PoP to minimize latency

### AI-Powered Features
- **AI Stem Separation** (Meta SAM): Isolate vocals, drums, bass, and other instruments from any backing track
- **AI Track Generation** (Suno AI): Describe the backing track you want and let AI create it
- **Endless Mode**: AI continuously extends the backing track

### Backing Track Management
- **Track Queue**: Upload MP3/WAV files or generate AI tracks
- **Synchronized Playback**: Room master controls play/pause/seek, all clients stay in sync
- **Stem Mixer**: Individual volume control for separated stems

### Real-time Collaboration
- **Presence System**: See who's in the room and their connection quality
- **Audio Level Meters**: Visual feedback for all participants
- **Chat**: Built-in text chat for coordination

## Technology Stack

| Component | Technology |
|-----------|------------|
| Web UI | React / Next.js |
| Media Routing | Cloudflare Calls (WebRTC) |
| State/Queue | Supabase Realtime |
| Audio Processing | Web Audio API / AudioWorklet |
| Storage (Songs) | Cloudflare R2 |

## Getting Started

### Prerequisites

For the best experience:
- **Wired ethernet connection** (Wi-Fi jitter causes audio glitches)
- **Dedicated audio interface** with ASIO/CoreAudio drivers
- **Wired headphones** to prevent feedback
- Modern browser with WebRTC support (Chrome, Firefox, Edge)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/openstudio.git
cd openstudio
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file:
```bash
cp .env.example .env.local
```

4. Configure your environment variables (see [Configuration](#configuration))

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

### Configuration

Create a `.env.local` file with the following variables:

```env
# Supabase (for real-time presence/sync)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudflare Calls (for WebRTC)
NEXT_PUBLIC_CLOUDFLARE_CALLS_URL=https://rtc.live.cloudflare.com/v1
NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID=your_app_id
CLOUDFLARE_CALLS_APP_SECRET=your_app_secret

# Cloudflare R2 (for track storage)
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=openstudio-tracks

# AI Services (optional)
SUNO_API_KEY=your_suno_api_key
SAM_API_KEY=your_sam_api_key
```

## Architecture

### Audio Flow

```
[Instrument] → [Audio Interface] → [Browser getUserMedia]
                                          ↓
                                    [AudioWorklet]
                                    (Noise Gate, Compressor)
                                          ↓
                                    [Opus Encoder]
                                          ↓
                              [WebRTC → Cloudflare Calls SFU]
                                          ↓
                              [All Other Participants]
```

### Sync Mechanism

Backing track synchronization uses a timestamp-based approach:
1. Room master sends "play" command with future timestamp (100ms ahead)
2. All clients receive the command and schedule playback for that exact moment
3. Each client plays the track locally - no network latency for the audio itself

### Jitter Buffer Algorithm

The adaptive jitter buffer automatically sizes based on network conditions:
- **128 samples (2.7ms)**: Excellent connection, lowest latency
- **256 samples (5.3ms)**: Good connection, default
- **512 samples (10.7ms)**: Fair connection
- **1024 samples (21.3ms)**: Poor connection, prioritizes stability

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── cloudflare/    # Cloudflare Calls session management
│   │   ├── rooms/         # Room CRUD
│   │   ├── sam/           # SAM audio separation
│   │   ├── suno/          # Suno AI generation
│   │   └── upload/        # Track upload
│   ├── room/[roomId]/     # Room page
│   └── page.tsx           # Landing page
├── components/
│   ├── audio/             # Audio visualization components
│   ├── room/              # Room-related components
│   ├── studio/            # Studio layout and controls
│   ├── tracks/            # Track queue and management
│   └── ui/                # Base UI components
├── hooks/
│   ├── useAudioEngine.ts  # Audio engine hook
│   └── useRoom.ts         # Room management hook
├── lib/
│   ├── ai/                # AI service integrations
│   ├── audio/             # Audio engine and jitter buffer
│   ├── cloudflare/        # Cloudflare Calls integration
│   ├── storage/           # R2 storage integration
│   └── supabase/          # Supabase realtime integration
├── stores/                # Zustand state stores
└── types/                 # TypeScript type definitions
```

## API Reference

### Room Management

- `POST /api/rooms` - Create a new room
- `GET /api/rooms?id={roomId}` - Get room details

### Track Upload

- `POST /api/upload` - Upload a track (multipart form data)
  - `file`: Audio file (MP3/WAV)
  - `name`: Track name
  - `artist`: Artist name (optional)
  - `roomId`: Room ID

### AI Services

- `POST /api/suno/generate` - Start AI track generation
- `GET /api/suno/status/{generationId}` - Check generation status
- `POST /api/sam/separate` - Start stem separation
- `GET /api/sam/status/{jobId}` - Check separation status

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Cloudflare Calls](https://developers.cloudflare.com/calls/) for WebRTC infrastructure
- [Supabase](https://supabase.com/) for real-time database
- [Meta SAM](https://ai.meta.com/blog/sam-audio/) for audio source separation
- [Suno AI](https://suno.ai/) for AI music generation
