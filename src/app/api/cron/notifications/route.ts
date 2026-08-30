import { NextResponse } from 'next/server';

import { getNotificationCronSecret } from '@/config/notifications';
import { processPendingNotifications } from '@/lib/notifications/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = getNotificationCronSecret();
  if (!secret) {
    return false;
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

async function run(): Promise<NextResponse> {
  const processed = await processPendingNotifications(40);
  return NextResponse.json({ processed });
}

/** Drains the notification outbox (retries). */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return run();
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return run();
}
