import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  const length = Math.max(actualBuffer.length, expectedBuffer.length, 1);
  const paddedActual = Buffer.alloc(length);
  const paddedExpected = Buffer.alloc(length);
  actualBuffer.copy(paddedActual);
  expectedBuffer.copy(paddedExpected);
  return (
    timingSafeEqual(paddedActual, paddedExpected) && actualBuffer.length === expectedBuffer.length
  );
}

function hasValidBasicAuth(request: NextRequest): boolean {
  const expectedUsername = process.env.BUD_BUD_USERNAME;
  const expectedPassword = process.env.BUD_BUD_PASSWORD;
  if (!expectedUsername && !expectedPassword) return true;
  if (!expectedUsername || !expectedPassword) return false;

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    return (
      constantTimeEqual(decoded.slice(0, separator), expectedUsername) &&
      constantTimeEqual(decoded.slice(separator + 1), expectedPassword)
    );
  } catch {
    return false;
  }
}

function allowedOrigins(request: NextRequest): Set<string> {
  const configured = (process.env.BUD_BUD_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([request.nextUrl.origin, ...configured]);
}

export function proxy(request: NextRequest) {
  if (!hasValidBasicAuth(request)) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Budget Buddy", charset="UTF-8"' },
    });
  }

  if (request.nextUrl.pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method)) {
    const fetchSite = request.headers.get('sec-fetch-site');
    const origin = request.headers.get('origin');
    if (fetchSite === 'cross-site' || (origin && !allowedOrigins(request).has(origin))) {
      return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon0.svg|icon1.png).*)'],
};
