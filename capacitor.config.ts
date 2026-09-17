import type { CapacitorConfig } from '@capacitor/cli';

// The app uses server rendering, middleware and API routes, so it can't be a static export.
// The native shell loads the deployed site instead. Set CAP_SERVER_URL to your production URL.
const config: CapacitorConfig = {
  appId: 'app.hamrah',
  appName: 'همراه',
  webDir: 'public', // placeholder; content comes from server.url
  backgroundColor: '#F4F4FA',
  server: {
    url: process.env.CAP_SERVER_URL ?? 'https://hamrah.example.com',
    cleartext: false,
    allowNavigation: ['*.supabase.co', 'meet.jit.si', 'checkout.stripe.com', '*.zarinpal.com', 'inquiry.withpersona.com'],
  },
  plugins: { PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] } },
};
export default config;
