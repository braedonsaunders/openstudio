'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Save,
  Lock,
  Trophy,
  BarChart3,
  Sparkles,
  Check,
} from 'lucide-react';
import type { AvatarUnlockRule, UnlockType } from '@/types/avatar';

interface UnlockRuleEditorProps {
  onRefresh: () => void;
}

const unlockTypeIcons: Record<UnlockType, React.ReactNode> = {
  level: <BarChart3 className="w-4 h-4 text-blue-500" />,
  achievement: <Trophy className="w-4 h-4 text-yellow-500" />,
  statistic: <Sparkles className="w-4 h-4 text-purple-500" />,
  manual: <Lock className="w-4 h-4 text-gray-500" />,
};

const unlockTypeLabels: Record<UnlockType, string> = {
  level: 'Level Requirement',
  achievement: 'Achievement',
  statistic: 'Statistic Threshold',
  manual: 'Manual Unlock',
};

export function UnlockRuleEditor({ onRefresh }: UnlockRuleEditorProps) {
  const [rules, setRules] = useState<AvatarUnlockRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AvatarUnlockRule | null>(null);
  const [formId, setFormId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<UnlockType>('level');
  const [formConditionKey, setFormConditionKey] = useState('');
  const [formConditionValue, setFormConditionValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deletingRule, setDeletingRule] = useState<AvatarUnlockRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/avatar/unlock-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Failed to load unlock rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormId('');
    setFormDisplayName('');
    setFormDescription('');
    setFormType('level');
    setFormConditionKey('');
    setFormConditionValue('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: AvatarUnlockRule) => {
    setEditingRule(rule);
    setFormId(rule.id);
    setFormDisplayName(rule.displayName);
    setFormDescription(rule.description || '');
    setFormType(rule.type);
    setFormConditionKey(rule.conditionKey || '');
    setFormConditionValue(rule.conditionValue?.toString() || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formId || !formDisplayName) return;
    setIsSaving(true);

    try {
      const payload = {
        id: formId.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        displayName: formDisplayName,
        description: formDescription || null,
        type: formType,
        conditionKey: formConditionKey || null,
        conditionValue: formConditionValue ? parseFloat(formConditionValue) : null,
      };

      if (editingRule) {
        const response = await fetch(`/api/admin/avatar/unlock-rules?id=${editingRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          setIsModalOpen(false);
          loadRules();
          onRefresh();
        }
      } else {
        const response = await fetch('/api/admin/avatar/unlock-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          setIsModalOpen(false);
          loadRules();
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/avatar/unlock-rules?id=${deletingRule.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeletingRule(null);
        loadRules();
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getConditionHint = () => {
    switch (formType) {
      case 'level':
        return 'Enter the minimum level required (e.g., 10)';
      case 'achievement':
        return 'Enter the achievement ID from your achievement system';
      case 'statistic':
        return 'Key: statistic name (e.g., tracks_completed), Value: threshold';
      case 'manual':
        return 'No condition needed - admin grants access manually';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Unlock Rules
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadRules}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Define unlock conditions that can be applied to avatar components.
      </p>

      {/* Rules List */}
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {unlockTypeIcons[rule.type]}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {rule.displayName}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {unlockTypeLabels[rule.type]}
                  </p>
                  {rule.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {rule.description}
                    </p>
                  )}
                  {rule.conditionKey && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                      {rule.conditionKey}
                      {rule.conditionValue !== null && ` ≥ ${rule.conditionValue}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(rule)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingRule(rule)}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No unlock rules defined</p>
          <p className="text-sm mt-2">Create rules to gate avatar components behind achievements</p>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? 'Edit Unlock Rule' : 'Add Unlock Rule'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rule ID
            </label>
            <Input
              value={formId}
              onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="e.g., level_10_required"
              disabled={!!editingRule}
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier. Lowercase, underscores only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <Input
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="e.g., Reach Level 10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <Input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g., Unlocked by reaching level 10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unlock Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as UnlockType)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="level">Level Requirement</option>
              <option value="achievement">Achievement</option>
              <option value="statistic">Statistic Threshold</option>
              <option value="manual">Manual Unlock</option>
            </select>
          </div>

          {formType !== 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {formType === 'level' ? 'Level' : formType === 'achievement' ? 'Achievement ID' : 'Statistic Key'}
                </label>
                <Input
                  value={formConditionKey}
                  onChange={(e) => setFormConditionKey(e.target.value)}
                  placeholder={formType === 'level' ? 'level' : formType === 'achievement' ? 'first_win' : 'tracks_completed'}
                />
              </div>
              {formType !== 'achievement' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Required Value
                  </label>
                  <Input
                    type="number"
                    value={formConditionValue}
                    onChange={(e) => setFormConditionValue(e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">{getConditionHint()}</p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formId || !formDisplayName}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingRule}
        onClose={() => setDeletingRule(null)}
        title="Delete Unlock Rule"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="text-gray-900 dark:text-white font-medium">
              {deletingRule?.displayName}
            </span>
            ?
          </p>
          <p className="text-sm text-red-500">
            This will remove this unlock requirement from all components using it.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingRule(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
