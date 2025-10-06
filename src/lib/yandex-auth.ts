'use server';

import jwt from 'jsonwebtoken';

const SERVICE_ACCOUNT_ID = process.env.YANDEX_SERVICE_ACCOUNT_ID || '';
const KEY_ID = process.env.YANDEX_API_KEY_ID || '';
const PRIVATE_KEY = (process.env.YANDEX_API_KEY_SECRET || '').replace(/\\n/g, '\n');

let cachedIAMToken: { token: string; expiresAt: number; } | null = null;

export async function getIAMToken(): Promise<string> {
  if (cachedIAMToken && cachedIAMToken.expiresAt > Date.now() + 60 * 1000) {
    return cachedIAMToken.token;
  }

  console.log('[Auth] IAM-токен просрочен или отсутствует. Получаем новый...');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iss: SERVICE_ACCOUNT_ID,
    iat: now,
    exp: now + 3600, // Токен живет 1 час
  };

  const signedJwt = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'PS256',
    keyid: KEY_ID,
  });

  const response = await fetch('https://iam.api.cloud.yandex.net/iam/v1/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt: signedJwt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get IAM token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const iamToken = data.iamToken;

  cachedIAMToken = {
    token: iamToken,
    expiresAt: now * 1000 + 3600 * 1000,
  };

  console.log('[Auth] Новый IAM-токен успешно получен.');
  return iamToken;
}
