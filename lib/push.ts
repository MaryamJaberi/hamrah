import 'server-only';
import webpush from 'web-push';
import { GoogleAuth } from 'google-auth-library';
import { admin } from './supabase/admin';

type Payload = { title: string; body: string; url?: string };

let vapidReady = false;
function initVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', pub, priv);
  return (vapidReady = true);
}

let fcmAuth: GoogleAuth | null = null;
async function fcmToken() {
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!json || !process.env.FCM_PROJECT_ID) return null;
  fcmAuth ??= new GoogleAuth({ credentials: JSON.parse(json), scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
  return (await fcmAuth.getAccessToken()) ?? null;
}

export async function sendToUser(userId: string, payload: Payload) {
  const db = admin();

  if (initVapid()) {
    const { data: subs } = await db.from('push_subs').select('*').eq('user_id', userId);
    await Promise.allSettled((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) await db.from('push_subs').delete().eq('id', s.id);
      }
    }));
  }

  const { data: tokens } = await db.from('native_push_tokens').select('*').eq('user_id', userId);
  if (tokens?.length) {
    const access = await fcmToken();
    if (!access) return;
    await Promise.allSettled(tokens.map(async (t) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: t.token, notification: { title: payload.title, body: payload.body }, data: { url: payload.url ?? '/' } } }),
      });
      if (res.status === 404) await db.from('native_push_tokens').delete().eq('id', t.id);
    }));
  }
}
