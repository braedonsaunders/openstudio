# OpenStudio MVP Security Audit Report

**Date:** January 6, 2026
**Auditor:** Claude Security Review
**Scope:** Pre-launch MVP security assessment
**Status:** REQUIRES FIXES BEFORE LAUNCH

---

## Executive Summary

This security audit identified **3 critical**, **5 high**, **4 medium**, and **3 low** severity issues that should be addressed before MVP launch. The most critical issues relate to **unauthenticated file uploads**, **guest ID spoofing**, and **overly permissive database grants**.

### Risk Matrix
| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | Must fix before launch |
| HIGH | 5 | Should fix before launch |
| MEDIUM | 4 | Fix soon after launch |
| LOW | 3 | Address in future sprint |

---

## CRITICAL Issues (Must Fix Before Launch)

### 1. [CRITICAL] Unauthenticated File Upload Endpoint

**Location:** `src/app/api/upload/route.ts:8-70`

**Issue:** The `/api/upload` endpoint accepts file uploads without any authentication, file type validation, or file size limits. Files are stored in an in-memory Map (mock storage) which will lose all data on server restart.

```typescript
// Current code - NO authentication check
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    // ... No auth, no validation
```

**Impact:**
- Anyone can upload arbitrary files to the server
- Potential for malicious file uploads
- Disk exhaustion attacks
- Data loss on restart (mock storage)

**Recommendation:**
- Use the authenticated presign endpoint (`/api/upload/presign`) exclusively
- Remove or disable the mock `/api/upload` endpoint
- If the endpoint is needed, add authentication and validation

---

### 2. [CRITICAL] Guest User ID Spoofing

**Location:** Multiple API routes including:
- `src/app/api/rooms/[roomId]/permissions/route.ts:19-21`
- `src/app/api/cloudflare/session/route.ts:146-149`
- `src/app/api/rooms/[roomId]/user-tracks/route.ts:116`

**Issue:** Guest users provide their own `userId` via query parameters or request body. This ID is trusted without validation, allowing any user to impersonate another guest.

```typescript
// Example from permissions route
const guestUserId = searchParams.get('guestUserId');
const effectiveUserId = user?.id || guestUserId;  // Client-controlled!
```

**Impact:**
- Guest A can impersonate Guest B by using their ID
- Access to another user's tracks, permissions, and session data
- Potential for session hijacking in rooms

**Recommendation:**
1. Generate and sign guest IDs server-side using JWT or HMAC
2. Store guest sessions in database with validation tokens
3. Never trust client-provided user identifiers

**Example Fix:**
```typescript
// Generate signed guest ID on first request
import { createHmac } from 'crypto';

function generateGuestId(): string {
  const id = uuidv4();
  const signature = createHmac('sha256', process.env.GUEST_SECRET!)
    .update(id)
    .digest('hex')
    .slice(0, 8);
  return `guest-${id}-${signature}`;
}

function validateGuestId(guestId: string): boolean {
  const parts = guestId.split('-');
  if (parts.length !== 4 || parts[0] !== 'guest') return false;
  const id = `${parts[1]}-${parts[2]}`;
  const expectedSig = createHmac('sha256', process.env.GUEST_SECRET!)
    .update(id)
    .digest('hex')
    .slice(0, 8);
  return parts[3] === expectedSig;
}
```

---

### 3. [CRITICAL] Overly Permissive Database Grants

**Location:** Multiple migration files:
- `supabase/migrations/20241227_user_tracks.sql:111-112`
- `supabase/migrations/20251228_user_custom_loops.sql:76-77`
- `supabase/migrations/20241229_loop_tracks.sql:89-90`
- `supabase/migrations/20260102_saved_rooms.sql:152-155`

**Issue:** Several tables grant ALL permissions to the `anon` role:

```sql
GRANT ALL ON user_tracks TO anon;
GRANT ALL ON user_tracks TO authenticated;
```

**Impact:**
- Anonymous users may bypass RLS policies in certain configurations
- Potential for data manipulation without authentication
- Service role escalation risks

**Recommendation:**
1. Replace `GRANT ALL` with specific permissions: `GRANT SELECT, INSERT, UPDATE, DELETE`
2. For anonymous users, only grant `SELECT` where needed
3. Use RLS policies as the primary access control

**Example Fix:**
```sql
-- Instead of GRANT ALL TO anon
GRANT SELECT ON user_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_tracks TO authenticated;
```

---

## HIGH Severity Issues

### 4. [HIGH] TURN Credentials Exposed to Client

**Location:** `src/lib/cloudflare/calls.ts:137-138`

**Issue:** TURN server credentials are exposed via `NEXT_PUBLIC_` environment variables:

```typescript
const turnUsername = process.env.NEXT_PUBLIC_CLOUDFLARE_TURN_USERNAME;
const turnCredential = process.env.NEXT_PUBLIC_CLOUDFLARE_TURN_CREDENTIAL;
```

**Impact:**
- TURN credentials visible in browser JavaScript
- Potential for credential abuse/theft
- Bandwidth costs if credentials are leaked

**Recommendation:**
- Generate short-lived TURN credentials server-side
- Use an API endpoint to fetch credentials with rate limiting
- Cloudflare Calls may support credential-less TURN via their API

---

### 5. [HIGH] Admin Supabase Client Used Without Necessity

**Location:** Multiple routes use `getAdminSupabase()` when `getAnonSupabase()` would suffice:
- `src/app/api/rooms/[roomId]/user-tracks/route.ts:17`
- `src/app/api/rooms/[roomId]/permissions/route.ts:23`

**Issue:** API routes use the admin client (bypasses RLS) even for operations that should respect RLS.

**Impact:**
- RLS policies are bypassed
- Increased risk if vulnerabilities exist in query logic

**Recommendation:**
- Use `getAnonSupabase()` with user's JWT for RLS-respecting operations
- Only use `getAdminSupabase()` for genuine admin operations
- Add comments justifying each admin client usage

---

### 6. [HIGH] WebRTC Session Deletion Without Ownership Verification

**Location:** `src/app/api/cloudflare/session/route.ts:380-411`

**Issue:** The DELETE endpoint allows removing sessions without verifying ownership:

```typescript
export async function DELETE(request: NextRequest) {
  const sessionId = searchParams.get('sessionId');
  const roomId = searchParams.get('roomId');
  // No ownership check - anyone can delete any session
  await removeRoomSession(roomId, sessionId);
}
```

**Impact:**
- Any user can kick others from WebRTC sessions
- Denial of service for room participants

**Recommendation:**
- Verify the requesting user owns the session before deletion
- Store session ownership in database

---

### 7. [HIGH] No Rate Limiting on Critical Endpoints

**Location:** Multiple API routes lack rate limiting:
- `src/app/api/rooms/route.ts` (room creation)
- `src/app/api/cloudflare/session/route.ts`
- `src/app/api/rooms/[roomId]/permissions/route.ts`

**Impact:**
- Resource exhaustion via room creation spam
- WebRTC session flooding
- Database abuse

**Recommendation:**
- Add rate limiting to all authenticated endpoints
- Use stricter limits for guests
- Consider implementing the rate limiter from `/api/upload/presign`

---

### 8. [HIGH] Public Room Access Without Verification

**Location:** `src/app/api/rooms/[roomId]/permissions/route.ts:31-44`

**Issue:** The code allows guests to join rooms without verifying the room is actually public:

```typescript
// For guests, skip membership check (they're joining)
if (user) {
  // ... membership check
}
// Guests bypass this entirely
```

**Impact:**
- Guests might access private rooms by guessing room IDs
- Room privacy settings may be ineffective

**Recommendation:**
- Always verify `room.is_public === true` before allowing guest access
- Return 403 for private rooms when accessed by guests

---

## MEDIUM Severity Issues

### 9. [MEDIUM] No CSRF Protection

**Issue:** No explicit CSRF token validation found in API routes. While Next.js API routes have some implicit protection via same-origin policy, explicit CSRF protection is recommended for state-changing operations.

**Recommendation:**
- Implement CSRF tokens for sensitive mutations
- Use SameSite cookies with Strict or Lax mode
- Verify Origin/Referer headers

---

### 10. [MEDIUM] Insufficient Input Validation

**Location:** Various API routes accept JSON bodies without schema validation

**Example:** `src/app/api/rooms/route.ts:42-54`
```typescript
const body = await request.json();
const { id, name, description, isPublic, ... } = body;
// No schema validation
```

**Recommendation:**
- Use Zod or similar for request body validation
- Validate all input types, lengths, and formats
- Sanitize string inputs

---

### 11. [MEDIUM] Search Query Injection Risk

**Location:** `src/lib/supabase/auth.ts:770-786`

**Issue:** While some sanitization exists, the pattern could be improved:

```typescript
const sanitizedQuery = query.replace(/[%_'"\\;,()]/g, '');
// Uses ilike with user input
.or(`username.ilike.%${sanitizedQuery}%,display_name.ilike.%${sanitizedQuery}%`)
```

**Recommendation:**
- Use parameterized queries where possible
- Implement allowlist validation for search patterns
- Consider using Supabase's built-in text search

---

### 12. [MEDIUM] Room ID Predictability

**Location:** `src/app/api/rooms/route.ts:58`

```typescript
const roomId = id || uuidv4().slice(0, 8);
```

**Issue:** Room IDs are 8-character UUID prefixes, providing ~32 bits of entropy. With 4 billion possibilities, determined attackers could enumerate rooms.

**Recommendation:**
- Use full UUIDs for private rooms
- Implement room enumeration protection (rate limiting, CAPTCHA)
- Consider different ID schemes for public vs private rooms

---

## LOW Severity Issues

### 13. [LOW] Verbose Error Messages

**Location:** Various API routes return detailed error messages that could aid attackers:

```typescript
return NextResponse.json({ error: 'Failed to delete room: ' + error.message });
```

**Recommendation:**
- Log detailed errors server-side
- Return generic error messages to clients
- Use error codes instead of messages

---

### 14. [LOW] Missing Security Headers

**Recommendation:** Add security headers via `next.config.ts`:
```typescript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ],
}]
```

---

### 15. [LOW] Hardcoded STUN Server

**Location:** `src/lib/cloudflare/calls.ts`

**Issue:** Uses Google's STUN server by default, which may have privacy implications.

**Recommendation:**
- Use Cloudflare's STUN servers
- Make STUN server configurable

---

## Positive Security Findings

The audit also identified several well-implemented security measures:

1. **SSRF Protection:** `src/lib/storage/r2.ts:15-73` implements comprehensive URL validation
2. **JWT Authentication:** Proper JWT validation via Supabase Auth
3. **Service Role Isolation:** Service role key is properly kept server-side
4. **Presigned Upload URLs:** `/api/upload/presign` has proper auth, validation, and rate limiting
5. **Search Sanitization:** Query sanitization present in search functions
6. **UUID Validation:** `src/lib/supabase/auth.ts:359-362` validates UUIDs before database operations
7. **SECURITY DEFINER Functions:** Database functions use SECURITY DEFINER appropriately

---

## Recommended Priority Order

### Before Launch (Blocking):
1. Fix guest ID spoofing (CRITICAL #2)
2. Remove/fix unauthenticated upload endpoint (CRITICAL #1)
3. Fix database grants (CRITICAL #3)
4. Add public room verification (HIGH #8)
5. Fix WebRTC session deletion (HIGH #6)

### First Week After Launch:
6. Move TURN credentials server-side (HIGH #4)
7. Add rate limiting to remaining endpoints (HIGH #7)
8. Review admin client usage (HIGH #5)

### First Month:
9. Add CSRF protection (MEDIUM #9)
10. Implement schema validation (MEDIUM #10)
11. Improve search sanitization (MEDIUM #11)
12. Enhance room ID security (MEDIUM #12)

---

## Summary

The codebase demonstrates good security awareness with proper JWT handling, RLS policies, and input sanitization in many areas. However, the identified critical and high-severity issues present real attack vectors that should be addressed before public launch.

**Key Areas Requiring Immediate Attention:**
1. Guest user authentication/verification
2. File upload security
3. Database permission refinement
4. Room access control for guests

Once these issues are resolved, the application will have a solid security foundation for MVP launch.
