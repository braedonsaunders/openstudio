#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = process.cwd();
const ORIGIN = process.env.OPENSTUDIO_PRODUCTION_ORIGIN || 'https://www.openstudio.cafe';
const ENV_PATH = process.env.OPENSTUDIO_PRODUCTION_ENV || `${ROOT}/.env.production.local`;
const REPORT_PATH = process.env.OPENSTUDIO_JAM_SMOKE_REPORT || '/tmp/openstudio-production-jam-smoke-result.json';
const ROOM_ID = process.env.OPENSTUDIO_JAM_SMOKE_ROOM_ID || `codexjam${Date.now().toString(36).slice(-7)}`;
const PERFORMER_COUNT = Number.parseInt(process.env.OPENSTUDIO_JAM_SMOKE_PERFORMERS || '5', 10);
const LISTENER_COUNT = Number.parseInt(process.env.OPENSTUDIO_JAM_SMOKE_LISTENERS || '3', 10);
const FRAME_COUNT = Number.parseInt(process.env.OPENSTUDIO_JAM_SMOKE_FRAMES || '30', 10);
const FRAME_SAMPLES = 960;
const HOST_BRIDGE_WS_PORT = 9999;
const HOST_BRIDGE_UDP_PORT = 41001;
const DOCKER_IMAGE = 'openstudio-bridge-smoke:trixie';
const DOCKER_HOST_GATEWAY = process.env.OPENSTUDIO_DOCKER_HOST_GATEWAY || '192.168.65.254';
const MAC_BRIDGE_BINARY = `${ROOT}/native-bridge/target/release/openstudio-bridge`;
const DOCKER_BRIDGE_BINARY = `${ROOT}/native-bridge/target/docker-smoke/release/openstudio-bridge`;
const EVENT_TIMEOUT_MS = 8000;
const REALTIME_SYNC_LEAD_MS = Number.parseInt(process.env.OPENSTUDIO_JAM_SMOKE_SYNC_LEAD_MS || '1000', 10);
const QUALITY_THRESHOLDS = Object.freeze({
  nativePacketLossPct: 0.1,
  nativeAudioDeliveryMs: 2500,
  nativePeerAudioFreshnessMs: 5000,
  realtimeDeliveryP95Ms: 500,
  realtimeDeliveryMaxMs: 1000,
  realtimeSkewP95Ms: 150,
  realtimeScheduledMinLeadMs: 250,
  cloudflareTracksPerPerformer: 2,
});
const SONOBUS_REFERENCE = Object.freeze({
  repository: 'https://github.com/sonosaurus/sonobus',
  revision: '35f1062dab196b9838a4bb529c4bf6592b7f5987',
  comparableSignals: [
    'per-peer ping and latency display',
    'jitter buffer fill and automatic resize behavior',
    'packet drop/resend accounting',
    'explicit round-trip latency measurement',
  ],
});

function parseEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Production env file not found at ${path}. Run: npx vercel env pull .env.production.local --environment=production --yes`);
  }

  const env = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = parseEnvFile(ENV_PATH);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GUEST_SECRET =
  env.GUEST_ID_SECRET ||
  (SUPABASE_SERVICE_ROLE_KEY
    ? createHmac('sha256', 'guest-id-salt').update(SUPABASE_SERVICE_ROLE_KEY).digest('hex')
    : null);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !GUEST_SECRET) {
  throw new Error('Missing Supabase or guest-signing production environment values');
}

function generateGuestId() {
  const id = randomUUID();
  const timestamp = Date.now().toString(36);
  const payload = `${id}-${timestamp}`;
  const signature = createHmac('sha256', GUEST_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 12);
  return `guest-${payload}-${signature}`;
}

async function checkedFetch(url, options = {}, label = url) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return { response, body };
}

async function supabaseRest(table, { method = 'GET', query = '', body = undefined, prefer = 'return=minimal' } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    prefer,
  };
  return checkedFetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }, `supabase:${table}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(options.env || {}) },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (options.inherit) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (options.inherit) process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${stderr || stdout}`));
      }
    });
    if (options.input !== undefined) {
      child.stdin.end(options.input);
    }
  });
}

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(options.env || {}) },
  });
  const logs = [];
  const pushLog = (stream, chunk) => {
    const text = chunk.toString();
    logs.push({ stream, text });
    if (logs.length > 250) logs.shift();
  };
  child.stdout.on('data', (chunk) => pushLog('stdout', chunk));
  child.stderr.on('data', (chunk) => pushLog('stderr', chunk));
  child.on('error', (error) => pushLog('error', `${error.message}\n`));
  return { child, logs };
}

async function ensureDockerImage() {
  try {
    await runCommand('docker', ['image', 'inspect', DOCKER_IMAGE]);
    return;
  } catch {
    const dockerfile = [
      'FROM debian:trixie-slim',
      'RUN apt-get update && apt-get install -y --no-install-recommends libopus0 ca-certificates && (apt-get install -y --no-install-recommends libasound2t64 || apt-get install -y --no-install-recommends libasound2) && rm -rf /var/lib/apt/lists/*',
      'ENTRYPOINT ["/openstudio-bridge"]',
      '',
    ].join('\n');
    await runCommand('docker', ['build', '-t', DOCKER_IMAGE, '-'], { input: dockerfile, inherit: true });
  }
}

function makeAudioFrame(amplitude, frameIndex) {
  const headerSize = 13;
  const buffer = new ArrayBuffer(headerSize + FRAME_SAMPLES * 4);
  const view = new DataView(buffer);
  view.setUint8(0, 1);
  view.setUint32(1, FRAME_SAMPLES, true);
  view.setBigUint64(5, BigInt(Date.now() + frameIndex), true);
  let offset = headerSize;
  for (let i = 0; i < FRAME_SAMPLES; i += 1) {
    const sample = Math.sin((i + frameIndex * 17) / 13) * amplitude;
    view.setFloat32(offset, sample, true);
    offset += 4;
  }
  return buffer;
}

class BridgeClient {
  constructor(participant, wsUrl) {
    this.participant = participant;
    this.wsUrl = wsUrl;
    this.ws = null;
    this.messages = [];
    this.errors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';
    this.ws.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data);
        this.messages.push(message);
        if (message.type === 'error') {
          this.errors.push(message);
        }
      } catch (error) {
        this.errors.push({ type: 'parseError', message: error.message });
      }
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${this.wsUrl}`)), 10000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error(`Failed connecting to ${this.wsUrl}`));
      }, { once: true });
    });
    await this.waitFor((message) => message.type === 'welcome', 'welcome');
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Bridge ${this.participant.name} websocket is not open`);
    }
    this.ws.send(JSON.stringify(message));
  }

  sendBinary(buffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Bridge ${this.participant.name} websocket is not open`);
    }
    this.ws.send(buffer);
  }

  async waitFor(predicate, label, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.messages.find(predicate);
      if (found) return found;
      await sleep(25);
    }
    throw new Error(`Timed out waiting for ${label} on ${this.participant.name}`);
  }

  async waitForAfter(startIndex, predicate, label, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.messages.slice(startIndex).find(predicate);
      if (found) return found;
      await sleep(25);
    }
    throw new Error(`Timed out waiting for ${label} on ${this.participant.name}`);
  }

  async requestPeerAudioStats(timeoutMs = 5000) {
    const startIndex = this.messages.length;
    this.send({ type: 'getPeerAudioStats' });
    return this.waitForAfter(
      startIndex,
      (message) => message.type === 'peerAudioStats',
      'peerAudioStats',
      timeoutMs,
    );
  }

  latest(type) {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      if (this.messages[index].type === type) return this.messages[index];
    }
    return null;
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  async measureControlRtt(iterations = 5) {
    const samples = [];
    for (let index = 0; index < iterations; index += 1) {
      const timestamp = Date.now() * 1000 + index;
      const sentAt = Date.now();
      this.send({ type: 'ping', timestamp });
      await this.waitFor(
        (message) => message.type === 'pong' && message.timestamp === timestamp,
        `pong:${timestamp}`,
        3000,
      );
      samples.push(Date.now() - sentAt);
      await sleep(25);
    }
    return summarizeNumbers(samples);
  }
}

function summarizeNumbers(values) {
  if (values.length === 0) {
    return { count: 0, min: null, max: null, mean: null, p50: null, p95: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
    return sorted[index];
  };
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number((sum / sorted.length).toFixed(2)),
    p50: percentile(0.5),
    p95: percentile(0.95),
  };
}

function summarizeRealtimeEvents(events) {
  const deliveryMaxes = events.map((event) => event.lastDeliveryMs);
  const deliverySkews = events.map((event) => event.deliverySkewMs);
  const scheduledEvents = events.filter((event) => event.expectedSyncTime !== null);
  const scheduledLeadTimes = scheduledEvents.flatMap((event) => event.deliveryLeadTimesMs);
  return {
    eventCount: events.length,
    allDelivered: events.every((event) => event.receivedBy === event.expectedReceivers),
    deliveryMs: summarizeNumbers(deliveryMaxes),
    deliverySkewMs: summarizeNumbers(deliverySkews),
    scheduledEventCount: scheduledEvents.length,
    scheduledLeadMs: summarizeNumbers(scheduledLeadTimes),
    scheduledLateDeliveryCount: scheduledEvents.reduce((sum, event) => sum + event.lateDeliveryCount, 0),
  };
}

function createRealtimeClient(participant) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const channel = client.channel(`room:${ROOM_ID}`, {
    config: { broadcast: { self: false }, presence: { key: participant.id } },
  });
  const received = [];
  const events = [
    'song:play',
    'song:pause',
    'song:seek',
    'song:trackStates',
    'song:position',
    'usertrack:update',
    'looptrack:play',
    'looptrack:update',
    'stem:toggle',
    'stem:volume',
    'backingtrack:volume',
    'tempo:update',
    'tempo:timesig',
    'key:update',
    'canvas:sync',
    'layout:update',
    'permissions:role_update',
    'permissions:custom_update',
    'nativebridge:endpoint',
    'state:request',
    'state:sync',
    'chat:message',
  ];
  for (const event of events) {
    channel.on('broadcast', { event }, ({ payload }) => {
      received.push({ event, payload, at: Date.now() });
    });
  }
  return { client, channel, received };
}

async function subscribeRealtime(roomClients) {
  await Promise.all(roomClients.map(({ channel, participant }) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Realtime subscribe timeout for ${participant.name}`)), 20000);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        await channel.track({
          id: participant.id,
          name: participant.name,
          role: participant.role,
          isListener: participant.role === 'listener',
          isPerformer: participant.role !== 'listener',
          hasNativeBridge: participant.role !== 'listener',
        });
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        reject(new Error(`Realtime subscribe failed for ${participant.name}: ${status}`));
      }
    });
  })));

  await sleep(1200);
}

async function broadcastAndExpect(roomClients, senderIndex, event, payload) {
  const sender = roomClients[senderIndex];
  const beforeCounts = new Map(roomClients.map((client) => [client.participant.id, client.received.length]));
  const sentAt = Date.now();
  const result = await sender.channel.send({ type: 'broadcast', event, payload });
  if (result !== 'ok') {
    throw new Error(`Realtime broadcast ${event} returned ${result}`);
  }

  const deadline = Date.now() + EVENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const missing = roomClients.filter((client) => {
      if (client.participant.id === sender.participant.id) return false;
      const startIndex = beforeCounts.get(client.participant.id) || 0;
      return !client.received.slice(startIndex).some((item) => item.event === event && item.payload?.smokeRunId === payload.smokeRunId);
    });
    if (missing.length === 0) {
      const deliveries = roomClients
        .filter((client) => client.participant.id !== sender.participant.id)
        .map((client) => {
          const startIndex = beforeCounts.get(client.participant.id) || 0;
          const received = client.received
            .slice(startIndex)
            .find((item) => item.event === event && item.payload?.smokeRunId === payload.smokeRunId);
          return { receiver: client.participant.name, receivedAt: received.at };
        });
      const receivedTimes = deliveries.map((delivery) => delivery.receivedAt);
      const firstReceivedAt = Math.min(...receivedTimes);
      const lastReceivedAt = Math.max(...receivedTimes);
      const expectedSyncTime = Number.isFinite(payload.smokeExpectedSyncTime)
        ? payload.smokeExpectedSyncTime
        : null;
      const deliveryLeadTimesMs = expectedSyncTime === null
        ? []
        : receivedTimes.map((receivedAt) => expectedSyncTime - receivedAt);
      return {
        event,
        sender: sender.participant.name,
        expectedReceivers: roomClients.length - 1,
        receivedBy: deliveries.length,
        firstDeliveryMs: firstReceivedAt - sentAt,
        lastDeliveryMs: lastReceivedAt - sentAt,
        deliverySkewMs: lastReceivedAt - firstReceivedAt,
        expectedSyncTime,
        minLeadTimeMs: deliveryLeadTimesMs.length > 0 ? Math.min(...deliveryLeadTimesMs) : null,
        lateDeliveryCount: deliveryLeadTimesMs.filter((leadMs) => leadMs < 0).length,
        deliveryLeadTimesMs,
      };
    }
    await sleep(50);
  }

  const missing = roomClients
    .filter((client) => client.participant.id !== sender.participant.id)
    .filter((client) => {
      const startIndex = beforeCounts.get(client.participant.id) || 0;
      return !client.received.slice(startIndex).some((item) => item.event === event && item.payload?.smokeRunId === payload.smokeRunId);
    })
    .map((client) => client.participant.name);
  throw new Error(`Realtime event ${event} missing on: ${missing.join(', ')}`);
}

async function waitForStats(clients, predicate, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const client of clients) {
      client.send({ type: 'getNetworkStats' });
    }
    await sleep(300);
    const stats = clients.map((client) => client.latest('networkStats'));
    if (stats.every(Boolean) && predicate(stats)) {
      return stats;
    }
  }
  throw new Error(`Timed out waiting for stats: ${label}`);
}

async function waitForAudioDelivery(clients, statsBeforeAudio, expectedRecvMinimum, timeoutMs = 25000) {
  const start = Date.now();
  const reachedAtMs = new Map();
  while (Date.now() - start < timeoutMs) {
    for (const client of clients) {
      client.send({ type: 'getNetworkStats' });
    }
    await sleep(100);
    const stats = clients.map((client) => client.latest('networkStats'));
    if (stats.every(Boolean)) {
      stats.forEach((stat, index) => {
        const before = statsBeforeAudio[index];
        if (
          !reachedAtMs.has(index)
          && stat.audioFramesRecv - before.audioFramesRecv >= expectedRecvMinimum
        ) {
          reachedAtMs.set(index, Date.now() - start);
        }
      });
      if (reachedAtMs.size === clients.length) {
        return {
          stats,
          deliveryMilestones: clients.map((client, index) => ({
            user: client.participant.name,
            reachedExpectedFramesMs: reachedAtMs.get(index),
          })),
        };
      }
    }
  }
  throw new Error('Timed out waiting for every bridge to receive production audio frames');
}

function peerAudioRows(peerAudioStats) {
  return peerAudioStats.flatMap(({ user, stats }) => (
    (stats.peers || []).map((peer) => ({ receiver: user, peer }))
  ));
}

function peerAudioTrackRows(peerAudioStats) {
  return peerAudioRows(peerAudioStats).flatMap(({ receiver, peer }) => (
    (peer.tracks || []).map((track) => ({ receiver, peer, track }))
  ));
}

async function waitForPeerAudioStats(clients, expectedActivePeers, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshots = await Promise.all(clients.map((client) => client.requestPeerAudioStats(3000).catch(() => null)));
    if (
      snapshots.every(Boolean)
      && snapshots.every((snapshot) => {
        const peers = snapshot.peers || [];
        const activePeers = peers.filter((peer) => (
          Number(peer.audioPacketsReceived || 0) > 0
          && Number(peer.lastAudioArrivalTimestampMs || 0) > 0
        ));
        return peers.length >= expectedActivePeers
          && activePeers.length >= expectedActivePeers
          && activePeers.every((peer) => Array.isArray(peer.tracks) && peer.tracks.length > 0);
      })
    ) {
      return clients.map((client, index) => ({
        user: client.participant.name,
        stats: snapshots[index],
      }));
    }
    await sleep(150);
  }
  throw new Error('Timed out waiting for per-peer audio arrival and jitter-buffer telemetry');
}

function sanitizePeerAudioStats(peerAudioStats) {
  return peerAudioStats.map(({ user, stats }) => ({
    user,
    peerCount: stats.peers?.length || 0,
    peers: (stats.peers || []).map((peer) => ({
      userName: peer.userName,
      hasNativeBridge: peer.hasNativeBridge,
      audioActive: peer.audioActive,
      rttMs: peer.rttMs,
      jitterMs: peer.jitterMs,
      packetLossPct: peer.packetLossPct,
      qualityScore: peer.qualityScore,
      audioPacketsReceived: peer.audioPacketsReceived,
      audioBytesReceived: peer.audioBytesReceived,
      lastAudioSequence: peer.lastAudioSequence,
      lastAudioSenderTimestampMs: peer.lastAudioSenderTimestampMs,
      lastAudioArrivalTimestampMs: peer.lastAudioArrivalTimestampMs,
      msSinceLastAudio: peer.msSinceLastAudio,
      tracks: (peer.tracks || []).map((track) => ({
        trackId: track.trackId,
        trackName: track.trackName,
        muted: track.muted,
        solo: track.solo,
        volume: track.volume,
        jitterBufferLevelSamples: track.jitterBufferLevelSamples,
        jitterBufferLevelMs: track.jitterBufferLevelMs,
        jitterBufferFillRatio: track.jitterBufferFillRatio,
        jitterBufferTargetRatio: track.jitterBufferTargetRatio,
        avgJitterMs: track.avgJitterMs,
        maxJitterMs: track.maxJitterMs,
        packetLossPct: track.packetLossPct,
        underruns: track.underruns,
        overruns: track.overruns,
        reordered: track.reordered,
        plcFrames: track.plcFrames,
      })),
    })),
  }));
}

function makeQualityGates({
  cloudflareTracks,
  performers,
  statsAfterAudio,
  statsDelta,
  audioDeliveryMilestones,
  peerAudioStats,
  audioSendStartedAt,
  realtimeSummary,
}) {
  const cloudflareTrackKinds = (cloudflareTracks.tracks || []).map((track) => (
    track.trackName.startsWith('room-media-') ? 'room-media' : 'audio'
  ));
  const expectedCloudflareTracks = performers.length * QUALITY_THRESHOLDS.cloudflareTracksPerPerformer;
  const latestPacketLoss = statsAfterAudio.map((stat) => Number(stat.packetLossPct || 0));
  const latestRtt = statsAfterAudio.map((stat) => Number(stat.rttMs || 0));
  const latestJitter = statsAfterAudio.map((stat) => Number(stat.jitterMs || 0));
  const deliveryTimes = audioDeliveryMilestones.map((milestone) => milestone.reachedExpectedFramesMs);
  const peerRows = peerAudioRows(peerAudioStats);
  const activePeerRows = peerRows.filter(({ peer }) => Number(peer.audioPacketsReceived || 0) > 0);
  const trackRows = peerAudioTrackRows(peerAudioStats);
  const activeTrackRows = trackRows.filter(({ peer }) => Number(peer.audioPacketsReceived || 0) > 0);
  const expectedPeerEdges = performers.length * (performers.length - 1);

  const blocking = [
    {
      name: 'cloudflare_listener_feed_tracks_registered',
      pass: cloudflareTrackKinds.length === expectedCloudflareTracks
        && cloudflareTrackKinds.filter((kind) => kind === 'audio').length === performers.length
        && cloudflareTrackKinds.filter((kind) => kind === 'room-media').length === performers.length,
      details: {
        expectedCloudflareTracks,
        actualCloudflareTracks: cloudflareTrackKinds.length,
        audioTracks: cloudflareTrackKinds.filter((kind) => kind === 'audio').length,
        roomMediaTracks: cloudflareTrackKinds.filter((kind) => kind === 'room-media').length,
      },
    },
    {
      name: 'native_bridge_full_mesh',
      pass: statsDelta.every((stat) => stat.peerCount >= performers.length - 1),
      details: statsDelta.map(({ user, peerCount }) => ({ user, peerCount })),
    },
    {
      name: 'native_audio_reached_every_performer',
      pass: statsDelta.every((stat) => stat.audioFramesRecvDelta >= FRAME_COUNT),
      details: statsDelta.map(({ user, audioFramesRecvDelta, audioSamplesRecvDelta }) => ({
        user,
        audioFramesRecvDelta,
        audioSamplesRecvDelta,
      })),
    },
    {
      name: 'native_audio_delivery_window',
      pass: deliveryTimes.every((timeMs) => timeMs <= QUALITY_THRESHOLDS.nativeAudioDeliveryMs),
      details: {
        thresholdMs: QUALITY_THRESHOLDS.nativeAudioDeliveryMs,
        deliveryMs: summarizeNumbers(deliveryTimes),
      },
    },
    {
      name: 'native_packet_loss_budget',
      pass: latestPacketLoss.every((packetLossPct) => packetLossPct <= QUALITY_THRESHOLDS.nativePacketLossPct),
      details: {
        thresholdPct: QUALITY_THRESHOLDS.nativePacketLossPct,
        packetLossPct: latestPacketLoss,
      },
    },
    {
      name: 'native_peer_rtt_telemetry_available',
      pass: latestRtt.every((rttMs) => rttMs > 0),
      details: {
        rttMs: latestRtt,
      },
    },
    {
      name: 'native_peer_audio_stats_available',
      pass: peerAudioStats.every(({ stats }) => (stats.peers || []).length >= performers.length - 1),
      details: peerAudioStats.map(({ user, stats }) => ({
        user,
        peerCount: stats.peers?.length || 0,
        expectedPeerCount: performers.length - 1,
      })),
    },
    {
      name: 'native_peer_audio_arrival_timestamps_fresh',
      pass: activePeerRows.length >= expectedPeerEdges
        && activePeerRows.every(({ peer }) => (
          Number(peer.lastAudioArrivalTimestampMs || 0) >= audioSendStartedAt
          && Number(peer.msSinceLastAudio ?? Number.POSITIVE_INFINITY) <= QUALITY_THRESHOLDS.nativePeerAudioFreshnessMs
        )),
      details: {
        expectedPeerEdges,
        activePeerEdges: activePeerRows.length,
        audioSendStartedAt,
        freshnessThresholdMs: QUALITY_THRESHOLDS.nativePeerAudioFreshnessMs,
        peers: activePeerRows.map(({ receiver, peer }) => ({
          receiver,
          peer: peer.userName,
          packets: peer.audioPacketsReceived,
          lastAudioArrivalTimestampMs: peer.lastAudioArrivalTimestampMs,
          msSinceLastAudio: peer.msSinceLastAudio,
        })),
      },
    },
    {
      name: 'native_jitter_buffers_reporting_per_track_fill',
      pass: activeTrackRows.length >= expectedPeerEdges
        && activeTrackRows.every(({ track }) => (
          Number(track.jitterBufferLevelSamples || 0) > 0
          && Number.isFinite(Number(track.jitterBufferLevelMs))
          && Number.isFinite(Number(track.jitterBufferFillRatio))
          && Number(track.jitterBufferFillRatio) >= 0
          && Number.isFinite(Number(track.jitterBufferTargetRatio))
          && Number(track.jitterBufferTargetRatio) >= 0
        )),
      details: {
        expectedPeerEdges,
        activeTrackRows: activeTrackRows.length,
        tracks: activeTrackRows.map(({ receiver, peer, track }) => ({
          receiver,
          peer: peer.userName,
          trackId: track.trackId,
          levelSamples: track.jitterBufferLevelSamples,
          levelMs: track.jitterBufferLevelMs,
          fillRatio: track.jitterBufferFillRatio,
          targetRatio: track.jitterBufferTargetRatio,
          avgJitterMs: track.avgJitterMs,
        })),
      },
    },
    {
      name: 'realtime_all_room_events_delivered',
      pass: realtimeSummary.allDelivered,
      details: {
        eventCount: realtimeSummary.eventCount,
        expectedReceiversPerEvent: PERFORMER_COUNT + LISTENER_COUNT - 1,
      },
    },
    {
      name: 'realtime_delivery_latency',
      pass: realtimeSummary.deliveryMs.p95 <= QUALITY_THRESHOLDS.realtimeDeliveryP95Ms
        && realtimeSummary.deliveryMs.max <= QUALITY_THRESHOLDS.realtimeDeliveryMaxMs,
      details: {
        p95ThresholdMs: QUALITY_THRESHOLDS.realtimeDeliveryP95Ms,
        maxThresholdMs: QUALITY_THRESHOLDS.realtimeDeliveryMaxMs,
        deliveryMs: realtimeSummary.deliveryMs,
      },
    },
    {
      name: 'realtime_sync_skew',
      pass: realtimeSummary.deliverySkewMs.p95 <= QUALITY_THRESHOLDS.realtimeSkewP95Ms,
      details: {
        p95ThresholdMs: QUALITY_THRESHOLDS.realtimeSkewP95Ms,
        deliverySkewMs: realtimeSummary.deliverySkewMs,
      },
    },
    {
      name: 'scheduled_transport_events_arrive_before_downbeat',
      pass: realtimeSummary.scheduledLateDeliveryCount === 0
        && realtimeSummary.scheduledLeadMs.min >= QUALITY_THRESHOLDS.realtimeScheduledMinLeadMs,
      details: {
        minLeadThresholdMs: QUALITY_THRESHOLDS.realtimeScheduledMinLeadMs,
        scheduledEventCount: realtimeSummary.scheduledEventCount,
        scheduledLeadMs: realtimeSummary.scheduledLeadMs,
        lateDeliveryCount: realtimeSummary.scheduledLateDeliveryCount,
      },
    },
  ];

  const warnings = [
    {
      name: 'native_peer_jitter_observed',
      pass: latestJitter.some((jitterMs) => jitterMs > 0),
      details: {
        jitterMs: latestJitter,
        reasonIfFalse: 'No jitter was observed in this local Docker/Mac topology; that is acceptable for the blocking launch gate.',
      },
    },
  ];

  return {
    pass: blocking.every((gate) => gate.pass),
    thresholds: QUALITY_THRESHOLDS,
    blocking,
    warnings,
  };
}

async function cleanupRoom(roomId) {
  const cleanupTargets = [
    ['room_webrtc_sessions', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['user_tracks', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['room_loop_tracks', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['songs', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['room_tracks', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['room_members', `room_id=eq.${encodeURIComponent(roomId)}`],
    ['rooms', `id=eq.${encodeURIComponent(roomId)}`],
  ];

  const deleted = [];
  for (const [table, query] of cleanupTargets) {
    const { response } = await supabaseRest(table, { method: 'DELETE', query });
    deleted.push({ table, status: response.status, ok: response.ok });
  }
  return deleted;
}

async function main() {
  if (PERFORMER_COUNT < 2 || LISTENER_COUNT < 1) {
    throw new Error('Use at least 2 performers and 1 listener for this smoke test');
  }
  if (!existsSync(MAC_BRIDGE_BINARY) || !existsSync(DOCKER_BRIDGE_BINARY)) {
    throw new Error('Native bridge release binaries are missing. Build native-bridge release and docker-smoke release first.');
  }

  await ensureDockerImage();

  const smokeRunId = `smoke-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const participants = [];
  for (let index = 0; index < PERFORMER_COUNT; index += 1) {
    participants.push({
      index,
      id: generateGuestId(),
      name: index === 0 ? 'Codex Jam Mac Performer' : `Codex Jam Docker Performer ${index + 1}`,
      role: index === 0 ? 'owner' : 'performer',
      kind: 'performer',
      trackId: `smoke-${index + 1}-audio`,
      bridgeTrackId: index,
    });
  }
  for (let index = 0; index < LISTENER_COUNT; index += 1) {
    participants.push({
      index: PERFORMER_COUNT + index,
      id: generateGuestId(),
      name: `Codex Jam Listener ${index + 1}`,
      role: 'listener',
      kind: 'listener',
    });
  }
  const performers = participants.filter((participant) => participant.kind === 'performer');
  const listeners = participants.filter((participant) => participant.kind === 'listener');
  const owner = performers[0];

  const nowIso = new Date().toISOString();
  await supabaseRest('rooms', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: ROOM_ID,
      name: `Codex Production Jam Smoke ${nowIso}`,
      created_by: owner.id,
      pop_location: 'auto',
      max_users: Math.max(10, participants.length),
      is_public: true,
      settings: {
        sampleRate: 48000,
        bufferSize: 128,
        networkMode: 'auto',
        maxPerformers: PERFORMER_COUNT,
        allowListeners: true,
      },
      description: 'Automated production jam smoke test room',
      genre: 'test',
      tags: ['codex-smoke'],
      last_activity: nowIso,
      color: 'cyan',
      icon: 'music',
      default_role: 'listener',
      require_approval: false,
    },
  });

  await supabaseRest('room_members', {
    method: 'POST',
    body: participants.map((participant) => ({
      room_id: ROOM_ID,
      user_id: participant.id,
      user_name: participant.name,
      role: participant.role,
      joined_at: nowIso,
      last_active_at: nowIso,
      is_banned: false,
    })),
  });

  const userTracks = performers.map((participant) => ({
    id: participant.trackId,
    room_id: ROOM_ID,
    user_id: participant.id,
    name: `${participant.name} Mic`,
    color: '#22d3ee',
    audio_settings: {
      inputMode: 'native',
      sampleRate: 48000,
      bufferSize: 128,
      bridgeTrackId: participant.bridgeTrackId,
      channelConfig: { channelCount: 1, leftChannel: 0 },
      directMonitoring: true,
      monitoringVolume: 0.8,
      effects: {},
    },
    is_muted: false,
    is_solo: false,
    volume: 0.88,
    is_armed: true,
    is_recording: false,
    owner_user_id: participant.id,
    owner_user_name: participant.name,
    is_active: true,
    track_type: 'audio',
  }));
  await supabaseRest('user_tracks', { method: 'POST', body: userTracks });

  const loopTrackId = randomUUID();
  await supabaseRest('room_loop_tracks', {
    method: 'POST',
    body: {
      id: loopTrackId,
      room_id: ROOM_ID,
      created_by: owner.id,
      created_by_name: owner.name,
      loop_id: `codex-loop-${smokeRunId}`,
      custom_midi_data: {
        ppq: 480,
        notes: [
          { note: 60, velocity: 96, start: 0, duration: 240 },
          { note: 64, velocity: 88, start: 240, duration: 240 },
          { note: 67, velocity: 92, start: 480, duration: 480 },
        ],
      },
      is_playing: false,
      sound_preset: 'keys/synth-pad',
      sound_settings: {},
      target_bpm: 124,
      target_key: 'D',
      volume: 0.72,
      muted: false,
      solo: false,
      name: 'Codex MIDI Loop',
      position: 0,
    },
  });

  const songId = randomUUID();
  const songTrackRefs = userTracks.map((track, index) => ({
    id: `ref-${index + 1}`,
    type: 'user-track',
    sourceId: track.id,
    name: track.name,
    startTime: index * 0.125,
    duration: 12,
    offset: 0,
    volume: 0.75,
    muted: false,
    solo: false,
    position: index,
  }));
  await supabaseRest('songs', {
    method: 'POST',
    body: {
      id: songId,
      room_id: ROOM_ID,
      name: 'Codex Production Sync Song',
      tracks: songTrackRefs,
      bpm: 124,
      key: 'D',
      time_signature: [4, 4],
      duration: 12,
      color: '#22d3ee',
      position: 0,
      created_by_name: owner.name,
    },
  });

  const webrtcRows = performers.flatMap((participant) => [
    {
      room_id: ROOM_ID,
      user_id: participant.id,
      session_id: `cf-${participant.index + 1}-mic-${smokeRunId}`,
      track_name: `audio-${participant.id}`,
    },
    {
      room_id: ROOM_ID,
      user_id: participant.id,
      session_id: `cf-${participant.index + 1}-room-${smokeRunId}`,
      track_name: `room-media-${participant.id}-${smokeRunId}`,
    },
  ]);
  await supabaseRest('room_webrtc_sessions', { method: 'POST', body: webrtcRows });

  const nativeTokens = [];
  for (const participant of performers) {
    const { body } = await checkedFetch(`${ORIGIN}/api/native-bridge/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId: ROOM_ID, userId: participant.id, userName: participant.name }),
    }, `native-token:${participant.name}`);
    nativeTokens.push({ participant, token: body.token, verifyUrl: body.verifyUrl });
  }

  const { body: cloudflareTracks } = await checkedFetch(`${ORIGIN}/api/cloudflare/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'getRoomTracks',
      roomId: ROOM_ID,
      userId: listeners[0].id,
    }),
  }, 'cloudflare:getRoomTracks');

  const processes = [];
  const clients = [];
  const realtimeClients = [];
  let cleanupResult = [];

  try {
    await runCommand('pkill', ['-f', 'openstudio-bridge --headless']).catch(() => undefined);
    await runCommand('docker', ['rm', '-f', ...performers.slice(1).map((_, index) => `openstudio-jam-smoke-${index + 2}`)]).catch(() => undefined);

    processes.push({
      name: owner.name,
      ...startProcess(MAC_BRIDGE_BINARY, ['--headless'], {
        env: {
          OPENSTUDIO_BRIDGE_WS_ADDR: `127.0.0.1:${HOST_BRIDGE_WS_PORT}`,
          OPENSTUDIO_P2P_BIND_ADDR: `0.0.0.0:${HOST_BRIDGE_UDP_PORT}`,
        },
      }),
    });

    for (let index = 1; index < performers.length; index += 1) {
      const participant = performers[index];
      const wsPort = 10000 + index;
      const udpPort = 41001 + index;
      const name = `openstudio-jam-smoke-${index + 1}`;
      const args = [
        'run',
        '--rm',
        '--name',
        name,
        '-e',
        `OPENSTUDIO_BRIDGE_WS_ADDR=0.0.0.0:${wsPort}`,
        '-e',
        `OPENSTUDIO_P2P_BIND_ADDR=0.0.0.0:${udpPort}`,
        '-p',
        `${wsPort}:${wsPort}/tcp`,
        '-p',
        `${udpPort}:${udpPort}/udp`,
        '-v',
        `${DOCKER_BRIDGE_BINARY}:/openstudio-bridge:ro`,
        DOCKER_IMAGE,
        '--headless',
      ];
      processes.push({
        name: participant.name,
        dockerName: name,
        wsPort,
        udpPort,
        ...startProcess('docker', args),
      });
    }

    await sleep(2500);

    for (let index = 0; index < performers.length; index += 1) {
      const participant = performers[index];
      const wsPort = index === 0 ? HOST_BRIDGE_WS_PORT : 10000 + index;
      const client = new BridgeClient(participant, `ws://127.0.0.1:${wsPort}`);
      await client.connect();
      client.send({ type: 'hello', version: '1.0.0', room_id: ROOM_ID, user_id: participant.id });
      clients.push(client);
    }

    for (const { participant, token, verifyUrl } of nativeTokens) {
      const client = clients.find((item) => item.participant.id === participant.id);
      client.send({
        type: 'joinRoom',
        roomId: ROOM_ID,
        roomSecret: token,
        userName: participant.name,
        authEndpoint: verifyUrl,
      });
    }

    await Promise.all(clients.map((client) => client.waitFor((message) => message.type === 'roomJoined', 'roomJoined', 15000)));

    for (const participant of performers) {
      const sourceClient = clients.find((client) => client.participant.id === participant.id);
      sourceClient.send({
        type: 'syncLocalTrack',
        trackId: participant.trackId,
        bridgeTrackId: participant.bridgeTrackId,
        trackName: `${participant.name} Mic`,
        channelConfig: { channelCount: 1, leftChannel: 0 },
      });
      sourceClient.send({
        type: 'updateTrackState',
        trackId: participant.trackId,
        isArmed: true,
        isMuted: false,
        isSolo: false,
        volume: 0.88,
        pan: 0,
        inputGainDb: 0,
        monitoringEnabled: true,
        monitoringVolume: 0.8,
      });
      sourceClient.send({
        type: 'setRoomContext',
        key: 'D',
        scale: 'major',
        bpm: 124,
        time_sig_num: 4,
        time_sig_denom: 4,
      });
      sourceClient.send({
        type: 'updateEffects',
        trackId: participant.trackId,
        effects: {
          reverb: { enabled: true },
          delay: { enabled: true },
          eq: { enabled: true },
          compressor: { enabled: true },
        },
      });
    }

    for (let sourceIndex = 0; sourceIndex < clients.length; sourceIndex += 1) {
      const source = clients[sourceIndex];
      for (let targetIndex = 0; targetIndex < performers.length; targetIndex += 1) {
        if (sourceIndex === targetIndex) continue;
        const target = performers[targetIndex];
        const targetUdpPort = targetIndex === 0 ? HOST_BRIDGE_UDP_PORT : 41001 + targetIndex;
        const addressHost = sourceIndex === 0 ? '127.0.0.1' : DOCKER_HOST_GATEWAY;
        source.send({
          type: 'connectPeer',
          userId: target.id,
          userName: target.name,
          address: `${addressHost}:${targetUdpPort}`,
        });
      }
    }

    await waitForStats(
      clients,
      (stats) => stats.every((stat) => stat.peerCount >= PERFORMER_COUNT - 1),
      `${PERFORMER_COUNT - 1} peers per bridge`,
      25000,
    );

    const bridgeControlRtt = await Promise.all(clients.map(async (client) => ({
      user: client.participant.name,
      websocketRttMs: await client.measureControlRtt(),
    })));

    await waitForStats(
      clients,
      (stats) => stats.every((stat) => stat.rttMs > 0),
      'native bridge peer RTT telemetry',
      10000,
    );

    const statsBeforeAudio = clients.map((client) => client.latest('networkStats'));

    const master = clients[0];
    const audioSendStartedAt = Date.now();
    master.send({ type: 'loadBackingTrack', url: `${ORIGIN}/codex-smoke-backing.wav`, duration: 12 });
    master.send({ type: 'playBackingTrack', sync_timestamp: Date.now() + 500, offset: 0 });
    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
      master.sendBinary(makeAudioFrame(0.18, frameIndex));
      await sleep(5);
    }
    master.send({ type: 'seekBackingTrack', time: 4.25 });
    master.send({ type: 'setBackingTrackVolume', volume: 0.58 });
    master.send({ type: 'setStemState', stem: 'drums', enabled: false, volume: 0.35 });
    master.send({ type: 'stopBackingTrack' });

    for (let sourceIndex = 0; sourceIndex < clients.length; sourceIndex += 1) {
      const source = clients[sourceIndex];
      source.send({
        type: 'updateTrackState',
        trackId: source.participant.trackId,
        isArmed: true,
        isMuted: sourceIndex === 1,
        isSolo: sourceIndex === 2,
        volume: 0.62 + sourceIndex * 0.04,
        pan: Math.max(-0.8, Math.min(0.8, -0.4 + sourceIndex * 0.2)),
        inputGainDb: sourceIndex,
        monitoringEnabled: true,
        monitoringVolume: 0.7,
      });
      for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
        source.sendBinary(makeAudioFrame(0.1 + sourceIndex * 0.025, frameIndex));
      }
      await sleep(40);
    }

    const expectedRecvMinimum = FRAME_COUNT;
    const {
      stats: statsAfterAudio,
      deliveryMilestones: audioDeliveryMilestones,
    } = await waitForAudioDelivery(clients, statsBeforeAudio, expectedRecvMinimum, 25000);
    const peerAudioStats = await waitForPeerAudioStats(clients, PERFORMER_COUNT - 1, 15000);

    for (const participant of participants) {
      const realtime = createRealtimeClient(participant);
      realtimeClients.push({ participant, ...realtime });
    }
    await subscribeRealtime(realtimeClients);

    const realtimeEvents = [];
    const senderIndex = 0;
    const scheduled = (builder) => () => {
      const syncTime = Date.now() + REALTIME_SYNC_LEAD_MS;
      return { ...builder(syncTime), smokeExpectedSyncTime: syncTime };
    };
    const immediate = (builder) => () => builder(Date.now());
    const eventPayloads = [
      ['song:play', scheduled((syncTime) => ({ smokeRunId, songId, currentTime: 0, syncTime, trackStates: songTrackRefs.map((track) => ({ trackRefId: track.id, muted: false, solo: false, volume: 0.75 })), userId: owner.id }))],
      ['song:position', immediate((timestamp) => ({ smokeRunId, songId, currentTime: 1.5, syncTimestamp: timestamp, isPlaying: true, userId: owner.id }))],
      ['song:seek', scheduled((syncTime) => ({ smokeRunId, songId, seekTime: 5.5, syncTime, userId: owner.id }))],
      ['song:pause', immediate(() => ({ smokeRunId, songId, currentTime: 5.5, userId: owner.id }))],
      ['song:trackStates', immediate(() => ({ smokeRunId, songId, trackStates: [{ trackRefId: songTrackRefs[0].id, muted: true, solo: false, volume: 0.42 }], userId: owner.id }))],
      ['usertrack:update', immediate(() => ({ smokeRunId, trackId: userTracks[1].id, updates: { isMuted: true, isSolo: false, volume: 0.42, isArmed: false }, userId: owner.id }))],
      ['looptrack:play', scheduled((syncTime) => ({ smokeRunId, trackId: loopTrackId, syncTimestamp: syncTime, loopStartBeat: 0, userId: owner.id }))],
      ['looptrack:update', immediate(() => ({ smokeRunId, trackId: loopTrackId, updates: { muted: true, volume: 0.31, solo: false }, userId: owner.id }))],
      ['stem:toggle', immediate(() => ({ smokeRunId, trackId: songTrackRefs[0].id, stem: 'drums', enabled: false, userId: owner.id }))],
      ['stem:volume', immediate(() => ({ smokeRunId, trackId: songTrackRefs[0].id, stem: 'bass', volume: 0.47, userId: owner.id }))],
      ['backingtrack:volume', immediate(() => ({ smokeRunId, volume: 0.58, userId: owner.id }))],
      ['tempo:update', immediate(() => ({ smokeRunId, tempo: 124, source: 'manual', userId: owner.id }))],
      ['tempo:timesig', immediate(() => ({ smokeRunId, beatsPerBar: 7, beatUnit: 8, userId: owner.id }))],
      ['key:update', immediate(() => ({ smokeRunId, key: 'D', keyScale: 'major', keySource: 'manual', userId: owner.id }))],
      ['canvas:sync', immediate((timestamp) => ({ smokeRunId, canvas: { elements: [{ id: `canvas-${smokeRunId}`, type: 'text', x: 64, y: 80, text: 'production smoke', fill: '#22d3ee' }], version: 1 }, updatedBy: owner.id, timestamp }))],
      ['layout:update', immediate((timestamp) => ({ smokeRunId, activePanel: 'mixer', isPanelDockVisible: true, isBottomDockVisible: true, mainView: 'notation', leftPanelWidth: 280, rightPanelWidth: 320, sharedSplitPosition: 55, updatedBy: owner.id, timestamp }))],
      ['permissions:role_update', immediate(() => ({ smokeRunId, targetUserId: listeners[0].id, role: 'listener', userId: owner.id }))],
      ['permissions:custom_update', immediate(() => ({ smokeRunId, targetUserId: performers[1].id, customPermissions: { mixer: { ownTrackVolume: true } }, userId: owner.id }))],
      ['nativebridge:endpoint', immediate((timestamp) => ({ smokeRunId, userId: owner.id, userName: owner.name, localEndpoint: `0.0.0.0:${HOST_BRIDGE_UDP_PORT}`, publicEndpoint: null, timestamp }))],
      ['state:request', immediate((timestamp) => ({ smokeRunId, userId: listeners[0].id, requestId: `${listeners[0].id}-${timestamp}` }))],
      ['state:sync', immediate((timestamp) => ({ smokeRunId, requestId: `${listeners[0].id}-${timestamp}`, queue: [], currentTrack: null, currentTrackPosition: 0, isPlaying: false, tempo: 124, tempoSource: 'manual', timeSignature: { beatsPerBar: 4, beatUnit: 4 }, key: 'D', keyScale: 'major', keySource: 'manual', userTracks, loopTracks: [], songs: [{ id: songId, name: 'Codex Production Sync Song' }], currentSongId: songId, stemMixState: {}, permissions: {}, songTrackStates: {}, currentSongIsPlaying: false, currentSongPosition: 5.5, timestamp, userId: owner.id }))],
      ['chat:message', immediate((timestamp) => ({ smokeRunId, message: 'production smoke chat', userId: owner.id, timestamp }))],
    ];

    for (const [event, buildPayload] of eventPayloads) {
      const payload = buildPayload();
      realtimeEvents.push(await broadcastAndExpect(realtimeClients, senderIndex, event, payload));
    }

    for (const client of clients) {
      client.send({ type: 'leaveRoom' });
    }
    await sleep(500);

    const statsDelta = clients.map((client, index) => ({
      user: client.participant.name,
      before: statsBeforeAudio[index],
      after: statsAfterAudio[index],
      audioFramesSentDelta: statsAfterAudio[index].audioFramesSent - statsBeforeAudio[index].audioFramesSent,
      audioFramesRecvDelta: statsAfterAudio[index].audioFramesRecv - statsBeforeAudio[index].audioFramesRecv,
      audioSamplesRecvDelta: statsAfterAudio[index].audioSamplesRecv - statsBeforeAudio[index].audioSamplesRecv,
      peerCount: statsAfterAudio[index].peerCount,
    }));
    const realtimeSummary = summarizeRealtimeEvents(realtimeEvents);
    const qualityGates = makeQualityGates({
      cloudflareTracks,
      performers,
      statsAfterAudio,
      statsDelta,
      audioDeliveryMilestones,
      peerAudioStats,
      audioSendStartedAt,
      realtimeSummary,
    });

    const bridgeErrors = clients.flatMap((client) => client.errors.map((error) => ({ user: client.participant.name, error })));
    if (bridgeErrors.length > 0) {
      throw new Error(`Native bridge reported errors: ${JSON.stringify(bridgeErrors)}`);
    }
    if (!qualityGates.pass) {
      throw new Error(`Production jam quality gates failed: ${JSON.stringify(qualityGates.blocking.filter((gate) => !gate.pass))}`);
    }

    cleanupResult = await cleanupRoom(ROOM_ID);

    const report = {
      pass: true,
      origin: ORIGIN,
      roomId: ROOM_ID,
      smokeRunId,
      participants: {
        performers: performers.map(({ name, role }) => ({ name, role })),
        listeners: listeners.map(({ name, role }) => ({ name, role })),
      },
      cloudflareTrackCount: cloudflareTracks.tracks?.length || 0,
      cloudflareTrackKinds: (cloudflareTracks.tracks || []).map((track) => (
        track.trackName.startsWith('room-media-') ? 'room-media' : 'audio'
      )),
      nativeBridge: {
        performerCount: performers.length,
        frameCount: FRAME_COUNT,
        frameSamples: FRAME_SAMPLES,
        bridgeControlRtt,
        audioDeliveryMilestones,
        statsDelta,
        peerAudioStats: sanitizePeerAudioStats(peerAudioStats),
      },
      realtime: {
        clientCount: realtimeClients.length,
        eventCount: realtimeEvents.length,
        summary: realtimeSummary,
        events: realtimeEvents,
      },
      sonobusComparison: {
        reference: SONOBUS_REFERENCE,
        openStudioSignalsCovered: [
          'production native bridge auth and room join',
          'full mesh native P2P connectivity',
          'backing/song audio frames broadcast through the native bridge room-media path',
          'per-peer native audio arrival timestamps and jitter-buffer fill telemetry',
          'per-room Cloudflare listener-feed track registration',
          'transport, seek, mixer, MIDI loop, stem, layout, permission, notes/canvas, and state sync broadcasts',
          'scheduled sync events arriving before their intended downbeat',
        ],
        remainingInstrumentationGap: 'Hardware loopback and real-WAN musical latency still need venue-style measurement; this harness now fails production if per-peer native arrival timestamps or jitter-buffer fill telemetry are missing.',
      },
      qualityGates,
      cleanup: cleanupResult,
    };
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const partialReport = {
      pass: false,
      origin: ORIGIN,
      roomId: ROOM_ID,
      error: error.message,
      bridgeErrors: clients.flatMap((client) => client.errors.map((bridgeError) => ({ user: client.participant.name, error: bridgeError }))),
      bridgeMessages: clients.map((client) => ({ user: client.participant.name, messages: client.messages.slice(-20) })),
      processLogs: processes.map((processInfo) => ({ name: processInfo.name, logs: processInfo.logs.slice(-30) })),
    };
    writeFileSync(REPORT_PATH, `${JSON.stringify(partialReport, null, 2)}\n`);
    throw error;
  } finally {
    for (const client of clients) {
      client.close();
    }
    for (const realtime of realtimeClients) {
      await realtime.channel.unsubscribe().catch(() => undefined);
      await realtime.client.removeAllChannels().catch(() => undefined);
    }
    for (const processInfo of processes) {
      if (!processInfo.child.killed) {
        processInfo.child.kill('SIGTERM');
      }
    }
    await runCommand('docker', ['rm', '-f', ...performers.slice(1).map((_, index) => `openstudio-jam-smoke-${index + 2}`)]).catch(() => undefined);
    if (cleanupResult.length === 0) {
      await cleanupRoom(ROOM_ID).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
