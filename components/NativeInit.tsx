'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Inside the Capacitor shell: register for native push and store the FCM token. No-op on the web. */
export default function NativeInit() {
  useEffect(() => {
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if ((await PushNotifications.requestPermissions()).receive !== 'granted') return;
      await PushNotifications.addListener('registration', async ({ value }) => {
        await supabase.from('native_push_tokens').upsert(
          { user_id: user.id, token: value, platform: Capacitor.getPlatform() as 'ios' | 'android' },
          { onConflict: 'user_id,token' });
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (n) => {
        const url = n.notification.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) window.location.href = url;
      });
      await PushNotifications.register();
    })().catch(() => {});
  }, []);
  return null;
}
