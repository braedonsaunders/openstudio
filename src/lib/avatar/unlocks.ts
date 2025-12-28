// Avatar component unlock evaluation logic

import type {
  AvatarComponent,
  AvatarUnlockRule,
  AvatarComponentUnlock,
  UserStats,
  UserAchievement,
} from '@/types/avatar';
import type { UserProfile } from '@/types/user';

export interface UnlockContext {
  profile: UserProfile;
  stats: UserStats | null;
  achievements: UserAchievement[];
  manuallyUnlockedIds: Set<string>;
}

/**
 * Check if a single unlock rule is satisfied
 */
export function isRuleSatisfied(
  rule: AvatarUnlockRule,
  context: UnlockContext
): boolean {
  if (!rule.isActive) return false;

  switch (rule.unlockType) {
    case 'none':
      return true;

    case 'level':
      return context.profile.level >= (rule.levelRequired ?? 0);

    case 'achievement':
      if (!rule.achievementId) return false;
      return context.achievements.some(
        (a) => a.achievementId === rule.achievementId
      );

    case 'statistic':
      if (!rule.statisticKey || !context.stats) return false;
      const statValue = getStatValue(context.stats, rule.statisticKey);
      if (statValue === null) return false;
      return evaluateStatistic(
        statValue,
        rule.statisticOperator ?? '>=',
        rule.statisticValue ?? 0
      );

    case 'manual':
      // Manual unlocks are handled separately via manuallyUnlockedIds
      return false;

    default:
      return false;
  }
}

/**
 * Get a statistic value by key
 */
function getStatValue(stats: UserStats, key: string): number | null {
  const keyMap: Record<string, keyof UserStats> = {
    total_jam_seconds: 'totalJamSeconds',
    total_jam_hours: 'totalJamSeconds', // Will convert below
    total_sessions: 'totalSessions',
    sessions_this_week: 'sessionsThisWeek',
    sessions_this_month: 'sessionsThisMonth',
    unique_collaborators: 'uniqueCollaborators',
    reactions_received: 'reactionsReceived',
    reactions_given: 'reactionsGiven',
    messages_sent: 'messagesSent',
    rooms_created: 'roomsCreated',
    rooms_joined: 'roomsJoined',
    tracks_uploaded: 'tracksUploaded',
    tracks_generated: 'tracksGenerated',
    stems_separated: 'stemsSeparated',
    longest_session_seconds: 'longestSessionSeconds',
    average_session_seconds: 'averageSessionSeconds',
  };

  const mappedKey = keyMap[key];
  if (!mappedKey) return null;

  let value = stats[mappedKey];

  // Handle array types
  if (Array.isArray(value)) return null;

  // Convert hours if needed
  if (key === 'total_jam_hours' && typeof value === 'number') {
    value = Math.floor(value / 3600);
  }

  return typeof value === 'number' ? value : null;
}

/**
 * Evaluate a statistic comparison
 */
function evaluateStatistic(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '=':
      return value === threshold;
    case '>':
      return value > threshold;
    default:
      return false;
  }
}

/**
 * Get all unlocked component IDs for a user
 */
export function getUnlockedComponentIds(
  components: AvatarComponent[],
  componentUnlocks: AvatarComponentUnlock[],
  unlockRules: AvatarUnlockRule[],
  context: UnlockContext
): Set<string> {
  const unlockedIds = new Set<string>();

  // Create a map of component ID to unlock rules
  const componentRulesMap = new Map<string, AvatarUnlockRule[]>();

  for (const unlock of componentUnlocks) {
    const rule = unlockRules.find((r) => r.id === unlock.unlockRuleId);
    if (rule) {
      const rules = componentRulesMap.get(unlock.componentId) || [];
      rules.push(rule);
      componentRulesMap.set(unlock.componentId, rules);
    }
  }

  for (const component of components) {
    if (!component.isActive) continue;

    // Check if manually unlocked
    if (context.manuallyUnlockedIds.has(component.id)) {
      unlockedIds.add(component.id);
      continue;
    }

    // Get unlock rules for this component
    const rules = componentRulesMap.get(component.id);

    // If no rules, component is available to everyone
    if (!rules || rules.length === 0) {
      unlockedIds.add(component.id);
      continue;
    }

    // Check if ANY rule is satisfied (OR logic)
    const isUnlocked = rules.some((rule) => isRuleSatisfied(rule, context));
    if (isUnlocked) {
      unlockedIds.add(component.id);
    }
  }

  return unlockedIds;
}

/**
 * Get unlock status for a single component
 */
export function getComponentUnlockStatus(
  componentId: string,
  componentUnlocks: AvatarComponentUnlock[],
  unlockRules: AvatarUnlockRule[],
  context: UnlockContext
): {
  isUnlocked: boolean;
  rules: AvatarUnlockRule[];
  satisfiedRules: AvatarUnlockRule[];
} {
  // Check if manually unlocked
  if (context.manuallyUnlockedIds.has(componentId)) {
    return { isUnlocked: true, rules: [], satisfiedRules: [] };
  }

  // Get rules for this component
  const componentRuleLinks = componentUnlocks.filter(
    (u) => u.componentId === componentId
  );

  // If no rules, it's unlocked
  if (componentRuleLinks.length === 0) {
    return { isUnlocked: true, rules: [], satisfiedRules: [] };
  }

  const rules = componentRuleLinks
    .map((link) => unlockRules.find((r) => r.id === link.unlockRuleId))
    .filter((r): r is AvatarUnlockRule => !!r);

  const satisfiedRules = rules.filter((rule) => isRuleSatisfied(rule, context));

  return {
    isUnlocked: satisfiedRules.length > 0,
    rules,
    satisfiedRules,
  };
}

/**
 * Get a human-readable description of an unlock requirement
 */
export function getUnlockDescription(rule: AvatarUnlockRule): string {
  switch (rule.unlockType) {
    case 'none':
      return 'Available to everyone';

    case 'level':
      return `Reach level ${rule.levelRequired}`;

    case 'achievement':
      return `Unlock achievement: ${rule.achievementId}`;

    case 'statistic':
      const statLabel = formatStatKey(rule.statisticKey ?? '');
      const op = rule.statisticOperator ?? '>=';
      const value = rule.statisticValue ?? 0;
      return `${statLabel} ${op} ${value}`;

    case 'manual':
      return 'Special unlock';

    default:
      return 'Unknown requirement';
  }
}

/**
 * Format a statistic key for display
 */
function formatStatKey(key: string): string {
  const labels: Record<string, string> = {
    total_jam_hours: 'Total jam hours',
    total_jam_seconds: 'Total jam time (seconds)',
    total_sessions: 'Total sessions',
    sessions_this_week: 'Sessions this week',
    sessions_this_month: 'Sessions this month',
    unique_collaborators: 'Unique collaborators',
    reactions_received: 'Reactions received',
    reactions_given: 'Reactions given',
    messages_sent: 'Messages sent',
    rooms_created: 'Rooms created',
    rooms_joined: 'Rooms joined',
    tracks_uploaded: 'Tracks uploaded',
    tracks_generated: 'AI tracks generated',
    stems_separated: 'Stems separated',
  };

  return labels[key] || key.replace(/_/g, ' ');
}

/**
 * Get available statistics for unlock rules
 */
export function getAvailableStatistics(): Array<{ key: string; label: string }> {
  return [
    { key: 'total_jam_hours', label: 'Total Jam Hours' },
    { key: 'total_sessions', label: 'Total Sessions' },
    { key: 'unique_collaborators', label: 'Unique Collaborators' },
    { key: 'reactions_received', label: 'Reactions Received' },
    { key: 'messages_sent', label: 'Messages Sent' },
    { key: 'rooms_created', label: 'Rooms Created' },
    { key: 'rooms_joined', label: 'Rooms Joined' },
    { key: 'tracks_uploaded', label: 'Tracks Uploaded' },
    { key: 'tracks_generated', label: 'AI Tracks Generated' },
    { key: 'stems_separated', label: 'Stems Separated' },
  ];
}
