import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllUnlockRules,
  createUnlockRule,
  updateUnlockRule,
  deleteUnlockRule,
  getComponentUnlocks,
} from '@/lib/avatar/supabase';
import type { CreateUnlockRuleRequest, UpdateUnlockRuleRequest } from '@/types/avatar';

// GET /api/admin/avatar/unlock-rules - List all unlock rules
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeComponents = searchParams.get('includeComponents') === 'true';

    const rules = await getAllUnlockRules();

    if (includeComponents) {
      const componentUnlocks = await getComponentUnlocks();

      // Group by rule
      const ruleComponents: Record<string, string[]> = {};
      for (const unlock of componentUnlocks) {
        if (!ruleComponents[unlock.unlockRuleId]) {
          ruleComponents[unlock.unlockRuleId] = [];
        }
        ruleComponents[unlock.unlockRuleId].push(unlock.componentId);
      }

      return NextResponse.json({
        rules,
        ruleComponents,
      });
    }

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to get unlock rules:', error);
    return NextResponse.json(
      { error: 'Failed to get unlock rules' },
      { status: 500 }
    );
  }
}

// POST /api/admin/avatar/unlock-rules - Create a new unlock rule
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as CreateUnlockRuleRequest;

    if (!body.id || !body.displayName || !body.unlockType) {
      return NextResponse.json(
        { error: 'Missing required fields: id, displayName, unlockType' },
        { status: 400 }
      );
    }

    // Validate type-specific requirements
    if (body.unlockType === 'level' && !body.levelRequired) {
      return NextResponse.json(
        { error: 'levelRequired is required for level unlock type' },
        { status: 400 }
      );
    }

    if (body.unlockType === 'achievement' && !body.achievementId) {
      return NextResponse.json(
        { error: 'achievementId is required for achievement unlock type' },
        { status: 400 }
      );
    }

    if (body.unlockType === 'statistic') {
      if (!body.statisticKey || !body.statisticOperator || body.statisticValue === undefined) {
        return NextResponse.json(
          { error: 'statisticKey, statisticOperator, and statisticValue are required for statistic unlock type' },
          { status: 400 }
        );
      }
    }

    const rule = await createUnlockRule(body);
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Failed to create unlock rule:', error);
    return NextResponse.json(
      { error: 'Failed to create unlock rule' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/avatar/unlock-rules - Update an unlock rule
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    const body = await req.json() as UpdateUnlockRuleRequest;
    const rule = await updateUnlockRule(id, body);

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Failed to update unlock rule:', error);
    return NextResponse.json(
      { error: 'Failed to update unlock rule' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/avatar/unlock-rules - Delete an unlock rule
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    await deleteUnlockRule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete unlock rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete unlock rule' },
      { status: 500 }
    );
  }
}
