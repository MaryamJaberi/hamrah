import 'server-only';

/** Normalizes to E.164. Iranian numbers like 0912… become +98912…; Dutch 06… become +316…. */
export function normalizePhone(input: string): string | null {
  let p = input.replace(/[\s\-()]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (/^09\d{9}$/.test(p)) p = '+98' + p.slice(1);
  if (/^06\d{8}$/.test(p)) p = '+31' + p.slice(1);
  return /^\+\d{10,15}$/.test(p) ? p : null;
}

export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  if (process.env.SMS_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production') {
    console.log(`[sms-dev] OTP for ${phone}: ${code}`);
    return true;
  }
  return phone.startsWith('+98') ? sendKavenegar(phone, code) : sendTwilio(phone, code);
}

async function sendKavenegar(phone: string, code: string) {
  const key = process.env.KAVENEGAR_API_KEY;
  if (!key) return false;
  // Verify/Lookup uses an approved template, which is required for OTP delivery in Iran.
  const params = new URLSearchParams({
    receptor: '0' + phone.slice(3), token: code, template: process.env.KAVENEGAR_OTP_TEMPLATE ?? 'hamrah-otp',
  });
  const res = await fetch(`https://api.kavenegar.com/v1/${key}/verify/lookup.json?${params}`);
  const json = await res.json().catch(() => null);
  return json?.return?.status === 200;
}

async function sendTwilio(phone: string, code: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: phone, Body: `Hamrah code: ${code}` }),
  });
  return res.ok;
}
