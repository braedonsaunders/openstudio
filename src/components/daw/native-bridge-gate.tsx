'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useNativeBridge } from '@/hooks/useNativeBridge';
import { cn } from '@/lib/utils';
import {
  Zap,
  Download,
  Headphones,
  Mic,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface NativeBridgeGateProps {
  /** Called when user is ready to join as performer (has native bridge) */
  onJoinAsPerformer: () => void;
  /** Called when user chooses to join as listener only (browser-only) */
  onJoinAsListener: () => void;
  /** Whether the room requires native bridge for performers */
  roomRequiresBridge?: boolean;
  /** Room name for display */
  roomName?: string;
  /** Current browser latency estimate */
  browserLatencyMs?: number;
}

export function NativeBridgeGate({
  onJoinAsPerformer,
  onJoinAsListener,
  roomRequiresBridge = false,
  roomName,
  browserLatencyMs = 85,
}: NativeBridgeGateProps) {
  const {
    isAvailable,
    isConnected,
    isRunning,
    driverType,
    latency,
    connect,
    getDownloadUrl,
  } = useNativeBridge();

  const [isConnecting, setIsConnecting] = useState(false);
  const [showDownloadInfo, setShowDownloadInfo] = useState(false);

  const nativeLatencyMs = latency.total > 0 ? latency.total : 8; // Estimate
  const latencyImprovement = Math.round((browserLatencyMs - nativeLatencyMs) / browserLatencyMs * 100);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDownload = () => {
    const url = getDownloadUrl();
    if (url) {
      window.open(url, '_blank');
      setShowDownloadInfo(true);
    }
  };

  // Note: We don't auto-proceed anymore - user should explicitly click "Join as Performer"
  // Audio starts AFTER joining, so isRunning will be false on this screen

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl border-slate-700">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">
            {roomName ? `Join "${roomName}"` : 'Join Session'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            For the best jamming experience, we recommend the Native Bridge
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Latency Comparison */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Latency Comparison</h3>
            <div className="space-y-3">
              {/* Browser Audio */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-sm text-slate-300">Browser Audio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${Math.min(browserLatencyMs / 100 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-amber-400 font-mono w-16 text-right">{browserLatencyMs}ms</span>
                </div>
              </div>

              {/* Native Bridge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm text-slate-300">Native Bridge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.min(nativeLatencyMs / 100 * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-emerald-400 font-mono w-16 text-right">{nativeLatencyMs}ms</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">Performance improvement</span>
              <span className="text-sm font-semibold text-emerald-400">
                {latencyImprovement}% faster
              </span>
            </div>
          </div>

          {/* Status Section */}
          {isConnected ? (
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              isRunning
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-amber-500/10 border-amber-500/30"
            )}>
              {isRunning ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Native Bridge Ready</p>
                    <p className="text-xs text-emerald-400/70">
                      {driverType} • {latency.total.toFixed(1)}ms latency
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">Bridge Connected</p>
                    <p className="text-xs text-amber-400/70">
                      Go to Audio Settings to start audio
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Download/Connect options */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDownload}
                  className="h-auto py-4 flex-col gap-2 border-slate-600 hover:border-indigo-500 hover:bg-indigo-500/10"
                >
                  <Download className="w-6 h-6 text-indigo-400" />
                  <span className="text-sm">Download Bridge</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="h-auto py-4 flex-col gap-2 border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10"
                >
                  {isConnecting ? (
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  ) : (
                    <Zap className="w-6 h-6 text-emerald-400" />
                  )}
                  <span className="text-sm">{isConnecting ? 'Connecting...' : 'Connect'}</span>
                </Button>
              </div>

              {showDownloadInfo && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                  <p className="text-xs text-indigo-300">
                    After installing, run the Native Bridge app and click &quot;Connect&quot; above.
                    <a
                      href="https://github.com/openstudio/native-bridge#readme"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 ml-1 text-indigo-400 hover:underline"
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Join Options */}
          <div className="space-y-3 pt-2">
            {/* Performer option - only requires connection, audio starts after joining */}
            <Button
              size="lg"
              disabled={!isConnected}
              onClick={onJoinAsPerformer}
              className={cn(
                "w-full h-14 text-base",
                isConnected
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
                  : "bg-slate-700 text-slate-400"
              )}
            >
              <Mic className="w-5 h-5 mr-2" />
              Join as Performer
              {isConnected && latency.total > 0 && (
                <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {latency.total.toFixed(0)}ms
                </span>
              )}
            </Button>

            {/* Listener option - uses Cloudflare Calls receive-only */}
            {!roomRequiresBridge && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onJoinAsListener}
                className="w-full h-12 text-slate-400 hover:text-slate-300 hover:bg-slate-800"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Join as Listener Only
                <span className="ml-2 text-xs text-slate-500">(receive audio only)</span>
              </Button>
            )}

            {roomRequiresBridge && !isConnected && (
              <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                This room requires Native Bridge for performers
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * User card component showing connection quality
 */
interface UserConnectionBadgeProps {
  hasNativeBridge: boolean;
  latencyMs: number;
  className?: string;
}

export function UserConnectionBadge({ hasNativeBridge, latencyMs, className }: UserConnectionBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        hasNativeBridge
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-amber-500/20 text-amber-400",
        className
      )}
    >
      {hasNativeBridge ? (
        <Zap className="w-3 h-3" />
      ) : (
        <Volume2 className="w-3 h-3" />
      )}
      <span>{latencyMs}ms</span>
      <span className="text-[10px] opacity-70">
        {hasNativeBridge ? driverTypeAbbrev() : 'Web'}
      </span>
    </div>
  );
}

function driverTypeAbbrev(): string {
  // This would need to come from the actual driver type
  return 'ASIO';
}

/**
 * Room settings component for requiring native bridge
 */
interface RoomBridgeSettingsProps {
  requireNativeBridge: boolean;
  onRequireChange: (require: boolean) => void;
  allowListeners: boolean;
  onAllowListenersChange: (allow: boolean) => void;
}

export function RoomBridgeSettings({
  requireNativeBridge,
  onRequireChange,
  allowListeners,
  onAllowListenersChange,
}: RoomBridgeSettingsProps) {
  return (
    <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        <Zap className="w-4 h-4 text-indigo-400" />
        Connection Requirements
      </h3>

      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Require Native Bridge
            </p>
            <p className="text-xs text-slate-500">
              Only users with Native Bridge can join as performers
            </p>
          </div>
          <button
            onClick={() => onRequireChange(!requireNativeBridge)}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors",
              requireNativeBridge ? "bg-indigo-600" : "bg-slate-600"
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                requireNativeBridge && "translate-x-5"
              )}
            />
          </button>
        </label>

        <label className="flex items-center justify-between cursor-pointer group">
          <div>
            <p className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Allow Browser Listeners
            </p>
            <p className="text-xs text-slate-500">
              Browser-only users can listen but not perform
            </p>
          </div>
          <button
            onClick={() => onAllowListenersChange(!allowListeners)}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors",
              allowListeners ? "bg-indigo-600" : "bg-slate-600"
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                allowListeners && "translate-x-5"
              )}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
