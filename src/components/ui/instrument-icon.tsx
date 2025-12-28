'use client';

import {
  Guitar,
  Music,
  Music2,
  Music3,
  Music4,
  Mic,
  Mic2,
  Headphones,
  Radio,
  Volume2,
  Waves,
  Zap,
  Wind,
  Sparkles,
  AudioWaveform,
  CircleDot,
  Disc,
  Disc2,
  Disc3,
  LucideIcon,
} from 'lucide-react';
import { INSTRUMENTS, type InstrumentIconName, type InstrumentDefinition } from '@/types/user';
import { cn } from '@/lib/utils';

// Custom Piano icon since Lucide doesn't have one
function Piano({ className, ...props }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 4v11" />
      <path d="M10 4v11" />
      <path d="M14 4v11" />
      <path d="M18 4v11" />
      <rect x="4" y="4" width="3" height="7" fill="currentColor" />
      <rect x="9" y="4" width="3" height="7" fill="currentColor" />
      <rect x="15" y="4" width="3" height="7" fill="currentColor" />
    </svg>
  );
}

// Custom Drum icon since Lucide doesn't have one
function Drum({ className, ...props }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <ellipse cx="12" cy="7" rx="9" ry="4" />
      <path d="M3 7v10c0 2.21 4.03 4 9 4s9-1.79 9-4V7" />
      <path d="M3 12c0 2.21 4.03 4 9 4s9-1.79 9-4" />
    </svg>
  );
}

// Map icon names to components
const iconMap: Record<InstrumentIconName, LucideIcon | React.FC<{ className?: string }>> = {
  Guitar,
  Music,
  Piano,
  Drum,
  Mic,
  Mic2,
  Music2,
  Music3,
  Music4,
  Headphones,
  Radio,
  Volume2,
  Waves,
  Zap,
  Wind,
  Sparkles,
  AudioWaveform,
  CircleDot,
  Disc,
  Disc2,
  Disc3,
};

interface InstrumentIconProps {
  instrumentId?: string;
  iconName?: InstrumentIconName;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showColor?: boolean;
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
};

export function InstrumentIcon({
  instrumentId,
  iconName,
  className,
  size = 'md',
  showColor = false,
}: InstrumentIconProps) {
  // Get instrument definition
  let instrument: InstrumentDefinition | undefined;
  let resolvedIconName: InstrumentIconName = 'Music';

  if (instrumentId && INSTRUMENTS[instrumentId]) {
    instrument = INSTRUMENTS[instrumentId];
    resolvedIconName = instrument.icon;
  } else if (iconName) {
    resolvedIconName = iconName;
  }

  const IconComponent = iconMap[resolvedIconName] || Music;

  // Color classes based on instrument color
  const colorClasses = showColor && instrument?.color
    ? `text-${instrument.color}-500`
    : '';

  return (
    <IconComponent
      className={cn(
        sizeClasses[size],
        colorClasses,
        className
      )}
    />
  );
}

interface InstrumentBadgeProps {
  instrumentId: string;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const badgeSizeClasses = {
  sm: 'h-6 px-2 text-xs gap-1',
  md: 'h-8 px-3 text-sm gap-1.5',
  lg: 'h-10 px-4 text-base gap-2',
};

export function InstrumentBadge({
  instrumentId,
  showName = true,
  size = 'md',
  className,
}: InstrumentBadgeProps) {
  const instrument = INSTRUMENTS[instrumentId];

  if (!instrument) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full',
        `bg-${instrument.color}-500/10 text-${instrument.color}-500`,
        badgeSizeClasses[size],
        className
      )}
    >
      <InstrumentIcon instrumentId={instrumentId} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
      {showName && <span>{instrument.name}</span>}
    </div>
  );
}

interface InstrumentSelectorProps {
  value?: string;
  onChange: (instrumentId: string) => void;
  category?: string;
  className?: string;
}

export function InstrumentSelector({
  value,
  onChange,
  category,
  className,
}: InstrumentSelectorProps) {
  // Group instruments by category
  const instrumentsByCategory = Object.entries(INSTRUMENTS).reduce(
    (acc, [id, inst]) => {
      if (!category || inst.category === category) {
        if (!acc[inst.category]) {
          acc[inst.category] = [];
        }
        acc[inst.category].push({ id, ...inst });
      }
      return acc;
    },
    {} as Record<string, Array<{ id: string } & InstrumentDefinition>>
  );

  const categoryLabels: Record<string, string> = {
    guitar: 'Guitar',
    keyboard: 'Keyboard',
    drums: 'Drums & Percussion',
    vocals: 'Vocals',
    strings: 'Strings',
    wind: 'Wind',
    electronic: 'Electronic',
    other: 'Other',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(instrumentsByCategory).map(([cat, instruments]) => (
        <div key={cat}>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            {categoryLabels[cat] || cat}
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {instruments.map((inst) => (
              <button
                key={inst.id}
                onClick={() => onChange(inst.id)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center',
                  value === inst.id
                    ? `bg-${inst.color}-500/20 text-${inst.color}-500 ring-2 ring-${inst.color}-500/50`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                <InstrumentIcon instrumentId={inst.id} size="lg" />
                <span className="text-[10px] leading-tight line-clamp-2">{inst.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default InstrumentIcon;
