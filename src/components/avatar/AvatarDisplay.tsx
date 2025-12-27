'use client';

import type { Avatar } from '@/types/user';

interface AvatarDisplayProps {
  avatar: Avatar | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  username?: string;
  showFrame?: boolean;
  showEffects?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

const frameSizes = {
  xs: 'w-7 h-7',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
};

const frameColors: Record<string, string> = {
  bronze: 'ring-amber-600',
  silver: 'ring-gray-400',
  gold: 'ring-yellow-400',
  diamond: 'ring-cyan-300 ring-opacity-80',
  fire: 'ring-orange-500',
};

export function AvatarDisplay({
  avatar,
  size = 'md',
  username,
  showFrame = true,
  showEffects = true,
  className = '',
}: AvatarDisplayProps) {
  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    const defaultBackground = {
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    };

    if (!avatar || !avatar.background) {
      return defaultBackground;
    }

    const bg = avatar.background;
    if (bg.type === 'solid') {
      return { backgroundColor: bg.colors[0] };
    } else if (bg.type === 'gradient') {
      return {
        background: `linear-gradient(135deg, ${bg.colors[0]} 0%, ${bg.colors[1] || bg.colors[0]} 100%)`,
      };
    }
    return defaultBackground;
  };

  // Get initials for fallback
  const getInitials = () => {
    if (username) {
      return username.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Get skin tone
  const skinTone = avatar?.skinTone || '#f5d0c5';

  // Get hair color
  const hairColor = avatar?.head?.hair?.color || '#4a3728';

  // Get outfit colors
  const outfitColor = avatar?.body?.outfit?.topColor || '#3b82f6';

  // Check for frame
  const frame = avatar?.frame;
  const frameClass = frame && frameColors[frame] ? frameColors[frame] : '';

  // Check for effects
  const auraEffect = showEffects && avatar?.effects?.aura;
  const particleEffect = showEffects && avatar?.effects?.particles;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Aura effect */}
      {auraEffect === 'fire' && (
        <div className="absolute inset-0 animate-pulse">
          <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-orange-500/30 blur-md`} />
        </div>
      )}
      {auraEffect === 'electric' && (
        <div className="absolute inset-0 animate-pulse">
          <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-blue-400/30 blur-md`} />
        </div>
      )}

      {/* Frame container */}
      <div
        className={`
          relative rounded-full overflow-hidden
          ${sizeClasses[size]}
          ${showFrame && frame ? `ring-2 ${frameClass}` : ''}
        `}
        style={getBackgroundStyle()}
      >
        {/* Avatar illustration */}
        <div className="absolute inset-0 flex items-end justify-center overflow-hidden">
          {/* Simple avatar rendering */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{ transform: 'translateY(10%)' }}
          >
            {/* Body/Outfit */}
            <ellipse
              cx="50"
              cy="95"
              rx="35"
              ry="25"
              fill={outfitColor}
            />

            {/* Neck */}
            <rect
              x="42"
              y="55"
              width="16"
              height="15"
              fill={skinTone}
            />

            {/* Head */}
            <ellipse
              cx="50"
              cy="40"
              rx="22"
              ry="25"
              fill={skinTone}
            />

            {/* Hair */}
            <ellipse
              cx="50"
              cy="28"
              rx="20"
              ry="18"
              fill={hairColor}
            />

            {/* Eyes */}
            <circle cx="42" cy="42" r="3" fill="#1a1a2e" />
            <circle cx="58" cy="42" r="3" fill="#1a1a2e" />
            <circle cx="43" cy="41" r="1" fill="white" />
            <circle cx="59" cy="41" r="1" fill="white" />

            {/* Mouth based on expression */}
            {avatar?.expression === 'happy' || avatar?.expression === 'excited' ? (
              <path
                d="M 42 52 Q 50 58 58 52"
                fill="none"
                stroke="#1a1a2e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : avatar?.expression === 'focused' ? (
              <line
                x1="44"
                y1="52"
                x2="56"
                y2="52"
                stroke="#1a1a2e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 44 52 Q 50 54 56 52"
                fill="none"
                stroke="#1a1a2e"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Eyebrows */}
            <line x1="38" y1="35" x2="45" y2="36" stroke={hairColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="55" y1="36" x2="62" y2="35" stroke={hairColor} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Fallback initial if no avatar */}
        {!avatar && (
          <div className="absolute inset-0 flex items-center justify-center font-bold text-white">
            {getInitials()}
          </div>
        )}
      </div>

      {/* Particle effects */}
      {particleEffect === 'notes' && (
        <div className="absolute -top-1 -right-1 text-xs">
          <span className="animate-bounce inline-block">🎵</span>
        </div>
      )}
      {particleEffect === 'stars' && (
        <div className="absolute -top-1 -right-1 text-xs">
          <span className="animate-pulse inline-block">✨</span>
        </div>
      )}
    </div>
  );
}
