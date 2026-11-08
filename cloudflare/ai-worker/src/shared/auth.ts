import { createRemoteJWKSet, jwtVerify } from 'jose';

// One JWKS client per Worker instance, reused across requests (cheap —
// `jose` caches the actual key fetch internally too). Built lazily since
// it needs `env.SUPABASE_URL`, which isn't available at module load time.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksForUrl = '';

function getJwks(supabaseUrl: string) {
  if (!jwks || jwksForUrl !== supabaseUrl) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksForUrl = supabaseUrl;
  }
  return jwks;
}

export interface AuthResult {
  /** Supabase user id (claim `sub`) — dipakai sebagai key rate limit per user. */
  userId: string;
}

/**
 * Verifies the caller is actually logged in to THIS Supabase project.
 * Without this, anyone who found the Worker's URL could burn the free
 * Gemini quota — every endpoint on this Worker checks the token's
 * signature against Supabase's own public keys before doing anything
 * that costs a Gemini call.
 *
 * Mengembalikan `null` kalau token tidak ada/tidak valid, atau
 * `{ userId }` kalau valid.
 */
export async function verifyAuth(request: Request, supabaseUrl: string): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl), { issuer: `${supabaseUrl}/auth/v1` });
    return { userId: typeof payload.sub === 'string' && payload.sub ? payload.sub : 'unknown' };
  } catch {
    return null;
  }
}
