// API endpoint to generate secure guest IDs
// Clients MUST use this endpoint to get a valid guest ID

import { NextRequest, NextResponse } from 'next/server';
import { generateGuestId, validateGuestId } from '@/lib/auth/guest';
import { checkRateLimit, rateLimiters, rateLimitResponse, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit guest ID generation to prevent abuse
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`guest:${clientId}`, rateLimiters.api);

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const guestId = generateGuestId();

    return NextResponse.json({
      guestId,
      expiresIn: 86400, // 24 hours (informational)
    });
  } catch (error) {
    console.error('Failed to generate guest ID:', error);
    return NextResponse.json(
      { error: 'Failed to generate guest ID' },
      { status: 500 }
    );
  }
}

// Validate an existing guest ID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  if (!guestId) {
    return NextResponse.json(
      { error: 'guestId parameter required' },
      { status: 400 }
    );
  }

  const isValid = validateGuestId(guestId);

  return NextResponse.json({
    valid: isValid,
  });
}
