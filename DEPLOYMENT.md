# OpenStudio Deployment Guide

Complete step-by-step instructions for deploying OpenStudio with all required services.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloudflare Setup](#cloudflare-setup)
   - [Cloudflare Account](#1-cloudflare-account)
   - [Cloudflare Calls (WebRTC)](#2-cloudflare-calls-webrtc)
   - [Cloudflare R2 (Storage)](#3-cloudflare-r2-storage)
3. [Supabase Setup](#supabase-setup)
4. [AI Services Setup](#ai-services-setup)
   - [Suno AI](#1-suno-ai-music-generation)
   - [Meta SAM](#2-meta-sam-audio-separation)
5. [Vercel Deployment](#vercel-deployment)
6. [Environment Variables Summary](#environment-variables-summary)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed locally
- [ ] A GitHub account (for Vercel deployment)
- [ ] A credit card (for Cloudflare and Supabase paid features - free tiers available)

---

## Cloudflare Setup

### 1. Cloudflare Account

1. Go to [cloudflare.com](https://dash.cloudflare.com/sign-up)
2. Click **Sign Up** and create an account
3. Verify your email address
4. Log in to the Cloudflare Dashboard

### 2. Cloudflare Calls (WebRTC)

Cloudflare Calls provides the SFU (Selective Forwarding Unit) for low-latency audio streaming.

#### Step 1: Enable Cloudflare Calls

1. In the Cloudflare Dashboard, click **Calls** in the left sidebar
2. If you don't see it, go to **Websites** → **Add a Site** (you need at least one domain)
3. Click **Enable Calls** or **Get Started**

#### Step 2: Create a Calls Application

1. Click **Create Application**
2. Enter application details:
   - **Name**: `openstudio`
   - **Description**: `OpenStudio Jamming Application`
3. Click **Create**

#### Step 3: Get Your Credentials

After creating the application, you'll see:

```
App ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
App Secret: your-secret-key-here
```

**Save these values!** You'll need them for environment variables:

```env
NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID=your-app-id
CLOUDFLARE_CALLS_APP_SECRET=your-app-secret
NEXT_PUBLIC_CLOUDFLARE_CALLS_URL=https://rtc.live.cloudflare.com/v1
```

#### Step 4: Configure TURN Servers (Optional but Recommended)

For better connectivity through firewalls:

1. In your Calls application settings, go to **TURN Configuration**
2. Enable **Cloudflare TURN**
3. Note the TURN credentials for your application

### 3. Cloudflare R2 (Storage)

R2 is S3-compatible object storage for backing tracks.

#### Step 1: Enable R2

1. In the Cloudflare Dashboard, click **R2** in the left sidebar
2. Click **Get Started** or **Enable R2**
3. Accept the terms of service

#### Step 2: Create a Bucket

1. Click **Create Bucket**
2. Enter bucket details:
   - **Bucket name**: `openstudio-tracks`
   - **Location hint**: Choose the region closest to your users
3. Click **Create Bucket**

#### Step 3: Create API Tokens

1. Go to **R2** → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Configure the token:
   - **Token name**: `openstudio-access`
   - **Permissions**: `Object Read & Write`
   - **Specify bucket(s)**: Select `openstudio-tracks`
4. Click **Create API Token**

**Save the credentials immediately** (they're only shown once):

```
Access Key ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Step 4: Get Your Account ID

1. Go to the Cloudflare Dashboard home
2. Click on any domain or go to **Workers & Pages**
3. Your **Account ID** is shown in the right sidebar

**Save these values:**

```env
CLOUDFLARE_R2_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=openstudio-tracks
```

#### Step 5: Configure CORS (Required for Browser Uploads)

1. Go to **R2** → **openstudio-tracks** → **Settings**
2. Scroll to **CORS Policy**
3. Click **Add CORS Policy**
4. Add this configuration:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Click **Save**

---

## Supabase Setup

Supabase provides real-time presence and database functionality.

### Step 1: Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project**
3. Sign up with GitHub (recommended) or email

### Step 2: Create a New Project

1. Click **New Project**
2. Enter project details:
   - **Name**: `openstudio`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose the closest to your users
3. Click **Create new project**
4. Wait for the project to be provisioned (1-2 minutes)

### Step 3: Get Your API Keys

1. Go to **Project Settings** (gear icon) → **API**
2. Find these values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (keep secret!)
```

**Save these values:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Enable Realtime

1. Go to **Database** → **Replication**
2. Ensure **Realtime** is enabled (it should be by default)

### Step 5: Create Database Tables (Optional)

For persistent room storage, run this SQL in the **SQL Editor**:

```sql
-- Rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pop_location TEXT DEFAULT 'auto',
  max_users INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb
);

-- Tracks table
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artist TEXT,
  duration REAL NOT NULL,
  url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ai_generated BOOLEAN DEFAULT false,
  stems JSONB
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access" ON rooms FOR SELECT USING (is_public = true);
CREATE POLICY "Public read access" ON tracks FOR SELECT USING (true);

-- Allow authenticated insert/update
CREATE POLICY "Allow insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert" ON tracks FOR INSERT WITH CHECK (true);
```

---

## AI Services Setup

### 1. Suno AI (Music Generation)

Suno AI generates backing tracks from text descriptions.

#### Option A: Official Suno API (When Available)

1. Go to [suno.ai](https://suno.ai)
2. Sign up for an account
3. Navigate to API settings (when available)
4. Generate an API key

```env
SUNO_API_KEY=your-suno-api-key
NEXT_PUBLIC_SUNO_API_URL=/api/suno
```

#### Option B: Self-Hosted Alternative (Replicate)

If Suno API isn't available, use Replicate with MusicGen:

1. Go to [replicate.com](https://replicate.com)
2. Sign up and get your API token
3. Use the MusicGen model

```env
REPLICATE_API_TOKEN=your-replicate-token
```

Update `/src/app/api/suno/generate/route.ts` to use Replicate:

```typescript
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Use facebook/musicgen-large model
const output = await replicate.run(
  "facebook/musicgen-large",
  {
    input: {
      prompt: "your music description",
      duration: 30,
    }
  }
);
```

### 2. Meta SAM Audio (Audio Separation)

Meta's [SAM Audio](https://ai.meta.com/samaudio/) (Segment Anything for Audio) is a state-of-the-art AI model that separates any sound from complex audio mixtures using text, visual, or time-span prompts.

OpenStudio supports three separation providers with automatic fallback:
1. **SAM Audio** (Primary) - Meta's official model
2. **Demucs** (Fallback) - Via Replicate
3. **Mock** (Demo) - For development/testing

#### Option A: Self-Hosted SAM Audio (Recommended for Quality)

Deploy Meta's official SAM Audio model from [facebookresearch/sam-audio](https://github.com/facebookresearch/sam-audio).

**Requirements:**
- GPU server with CUDA support
- VRAM: ~4GB (small), ~8GB (base), ~12GB+ (large)
- Python 3.10+, PyTorch, FFmpeg

**Step 1: Request Model Access**
1. Go to [Hugging Face: facebook/sam-audio-large](https://huggingface.co/facebook/sam-audio-large)
2. Request access to the model checkpoints
3. Once approved, authenticate with `huggingface-cli login`

**Step 2: Deploy with FastAPI**

```python
# server.py
import torch
import torchaudio
from fastapi import FastAPI, BackgroundTasks
from sam_audio import SAMAudio, SAMAudioProcessor
import uuid

app = FastAPI()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load model (choose size based on your GPU)
model = SAMAudio.from_pretrained("facebook/sam-audio-large").to(device).eval()
processor = SAMAudioProcessor.from_pretrained("facebook/sam-audio-large")

tasks = {}

@app.post("/api/separate/")
async def separate(audio_url: str, description: str, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "processing"}
    background_tasks.add_task(run_separation, task_id, audio_url, description)
    return {"task_id": task_id}

@app.get("/api/separate/{task_id}/status")
async def status(task_id: str):
    return tasks.get(task_id, {"status": "not_found"})

async def run_separation(task_id: str, audio_url: str, description: str):
    batch = processor(audios=[audio_url], descriptions=[description]).to(device)
    with torch.inference_mode():
        result = model.separate(batch, predict_spans=True, reranking_candidates=4)
    # Save and upload result, update task status
    tasks[task_id] = {"status": "completed", "target_url": "..."}
```

**Step 3: Configure Environment**

```env
SAM_AUDIO_API_URL=https://your-sam-server.com
SAM_API_KEY=your-api-key-if-needed
```

#### Option B: AudioGhost AI (Community API)

Use the community-built API wrapper from [0x0funky/audioghost-ai](https://github.com/0x0funky/audioghost-ai).

1. Clone and deploy the AudioGhost API
2. Configure environment:

```env
SAM_AUDIO_API_URL=https://your-audioghost-instance.com
SAM_API_KEY=your-audioghost-api-key
```

The API endpoints are compatible with OpenStudio's integration:
- `POST /api/separate/` - Start separation
- `GET /api/separate/{task_id}/status` - Check status
- `GET /api/separate/{task_id}/download/{stem}` - Download result

#### Option C: Demucs via Replicate (Easy Setup)

If you don't want to self-host SAM Audio, use Demucs via Replicate as a fallback:

1. Go to [replicate.com](https://replicate.com)
2. Sign up and get your API token
3. Configure environment:

```env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

OpenStudio will automatically use Demucs when `SAM_AUDIO_API_URL` is not configured.

#### Provider Priority

The separation API automatically selects providers in this order:
1. **SAM Audio** - If `SAM_AUDIO_API_URL` is configured
2. **Demucs** - If `REPLICATE_API_TOKEN` is configured
3. **Mock** - Demo mode with sample audio

You can also force a specific provider via the API:

```json
POST /api/sam/separate
{
  "trackId": "...",
  "trackUrl": "...",
  "provider": "sam" | "demucs" | "mock"
}
```

---

## Vercel Deployment

### Step 1: Push to GitHub

1. Create a new repository on GitHub
2. Push your code:

```bash
git remote add origin https://github.com/your-username/openstudio.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click **Add New Project**
4. Select your `openstudio` repository
5. Click **Import**

### Step 3: Configure Environment Variables

In the Vercel project settings, add all environment variables:

1. Go to **Settings** → **Environment Variables**
2. Add each variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` |
| `NEXT_PUBLIC_CLOUDFLARE_CALLS_URL` | `https://rtc.live.cloudflare.com/v1` |
| `NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID` | `your-app-id` |
| `CLOUDFLARE_CALLS_APP_SECRET` | `your-secret` |
| `CLOUDFLARE_R2_ACCOUNT_ID` | `your-account-id` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | `your-access-key` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | `your-secret-key` |
| `CLOUDFLARE_R2_BUCKET_NAME` | `openstudio-tracks` |
| `REPLICATE_API_TOKEN` | `your-replicate-token` |
| `SAM_AUDIO_API_URL` | `https://your-sam-server.com` (optional) |
| `SAM_API_KEY` | `your-sam-api-key` (optional) |

3. Click **Save**

### Step 4: Deploy

1. Click **Deploy**
2. Wait for the build to complete
3. Your app is live at `https://your-project.vercel.app`

### Step 5: Configure Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

---

## Environment Variables Summary

Create a `.env.local` file with all variables:

```env
# ===================
# SUPABASE
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===================
# CLOUDFLARE CALLS
# ===================
NEXT_PUBLIC_CLOUDFLARE_CALLS_URL=https://rtc.live.cloudflare.com/v1
NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CLOUDFLARE_CALLS_APP_SECRET=your-cloudflare-secret

# ===================
# CLOUDFLARE R2
# ===================
CLOUDFLARE_R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDFLARE_R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDFLARE_R2_BUCKET_NAME=openstudio-tracks

# ===================
# AI SERVICES
# ===================
# Replicate (for MusicGen and Demucs fallback)
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Meta SAM Audio (optional - for best quality stem separation)
SAM_AUDIO_API_URL=https://your-sam-audio-server.com
SAM_API_KEY=your-sam-api-key

# Suno API (when available)
SUNO_API_KEY=your-suno-api-key

# ===================
# OPTIONAL
# ===================
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

---

## Post-Deployment Verification

### 1. Test Room Creation

1. Visit your deployed app
2. Click **Create Room**
3. Enter your name and join
4. Verify the room loads without errors

### 2. Test Audio Capture

1. Allow microphone access when prompted
2. Speak/play and verify the level meter responds
3. Check the console for WebRTC connection logs

### 3. Test Multi-User (Two Browsers)

1. Open the room in two different browsers
2. Join with different names
3. Verify both users appear in the user list
4. Test audio streaming between browsers

### 4. Test Track Upload

1. Click **Upload** in the track queue
2. Select an MP3 or WAV file
3. Verify the track appears in the queue

### 5. Test AI Features

1. Click **AI Generate** in the track queue
2. Enter a prompt and generate
3. Verify the generation completes (may take 30-60s)

---

## Troubleshooting

### WebRTC Connection Issues

**Symptom**: Audio doesn't connect, "ICE connection failed"

**Solutions**:
1. Ensure Cloudflare Calls is properly configured
2. Check if TURN servers are enabled
3. Verify firewall isn't blocking UDP ports 3478, 5349
4. Try a different network (some corporate networks block WebRTC)

### CORS Errors

**Symptom**: "Access-Control-Allow-Origin" errors in console

**Solutions**:
1. Verify R2 CORS configuration includes your domain
2. Add `http://localhost:3000` for local development
3. Check Supabase project URL is correct

### Supabase Realtime Not Working

**Symptom**: Users don't see each other, presence not updating

**Solutions**:
1. Verify Realtime is enabled in Supabase dashboard
2. Check the anon key is correct (not the service key)
3. Look for WebSocket connection errors in console

### AI Generation Failing

**Symptom**: Track generation returns errors

**Solutions**:
1. Verify Replicate API token is valid
2. Check you have credits remaining on Replicate
3. Look at API response errors in server logs

### Audio Quality Issues

**Symptom**: Clicking, dropouts, high latency

**Solutions**:
1. Use wired ethernet instead of Wi-Fi
2. Use a dedicated audio interface (not built-in mic)
3. Close other applications using audio
4. Check the connection quality indicator in the app

---

## Cost Estimates (Free Tiers)

| Service | Free Tier | Overage |
|---------|-----------|---------|
| Cloudflare Calls | 1,000 participant-minutes/month | $0.05/min |
| Cloudflare R2 | 10GB storage, 1M requests | $0.015/GB |
| Supabase | 500MB DB, 2GB bandwidth | Pay as you go |
| Replicate | ~$0.0023/second for models | Pay per use |
| Vercel | 100GB bandwidth, unlimited builds | $20/mo Pro |

For a small jam session (5 users, 2 hours):
- Cloudflare Calls: ~600 participant-minutes ✅ Free
- R2 Storage: ~500MB for tracks ✅ Free
- Supabase: Minimal usage ✅ Free
- Replicate: ~$1-2 for AI generation

---

## Security Checklist

- [ ] Never commit `.env.local` to git
- [ ] Use environment variables in Vercel, not hardcoded values
- [ ] Enable Row Level Security on Supabase tables
- [ ] Rotate API keys periodically
- [ ] Set up Cloudflare WAF rules if using custom domain
- [ ] Enable Vercel deployment protection for production
