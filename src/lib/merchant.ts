import { createSign } from 'node:crypto';

/**
 * Cliente mínimo de Google Merchant API (v1) para sincronizar productos.
 * Sin dependencias nuevas: firma el JWT de la cuenta de servicio con
 * node:crypto y llama a la API REST con fetch.
 *
 * Variables de entorno (Vercel):
 *   GOOGLE_SERVICE_ACCOUNT_JSON     contenido completo del .json de la cuenta de servicio
 *   GOOGLE_MERCHANT_ACCOUNT_ID      ID de la cuenta de Merchant Center
 *   GOOGLE_MERCHANT_DATA_SOURCE_ID  ID de la fuente de datos tipo "API Merchant"
 */

const SCOPE = 'https://www.googleapis.com/auth/content';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BASE = 'https://merchantapi.googleapis.com/products/v1';

export const FEED_LABEL = 'AR';
export const CONTENT_LANGUAGE = 'es';

export interface MerchantConfig {
  accountId: string;
  dataSourceId: string;
  serviceAccountJson: string;
}

/** Devuelve la config o null si todavía falta alguna variable. */
export function getMerchantConfig(): MerchantConfig | null {
  const accountId = process.env.GOOGLE_MERCHANT_ACCOUNT_ID;
  const dataSourceId = process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!accountId || !dataSourceId || !serviceAccountJson) return null;
  return { accountId, dataSourceId, serviceAccountJson };
}

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(cfg: MerchantConfig): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > nowSec) return cached.token;

  const sa = JSON.parse(cfg.serviceAccountJson) as { client_email: string; private_key: string };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }),
  ).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.private_key).toString('base64url');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Token de Google rechazado (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, exp: nowSec + json.expires_in };
  return json.access_token;
}

export interface MerchantProductInput {
  offerId: string;
  contentLanguage: string;
  feedLabel: string;
  productAttributes: Record<string, unknown>;
}

export interface CallResult { ok: boolean; status: number; error?: string }

/** Crea o actualiza un producto (upsert por offerId) en la fuente de datos API. */
export async function insertProductInput(cfg: MerchantConfig, input: MerchantProductInput): Promise<CallResult> {
  const token = await getAccessToken(cfg);
  const url =
    `${BASE}/accounts/${cfg.accountId}/productInputs:insert` +
    `?dataSource=${encodeURIComponent(`accounts/${cfg.accountId}/dataSources/${cfg.dataSourceId}`)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.ok) return { ok: true, status: res.status };
  return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
}

/** Quita un producto de Merchant Center (404 = ya no estaba, se considera ok). */
export async function deleteProductInput(cfg: MerchantConfig, offerId: string): Promise<CallResult> {
  const token = await getAccessToken(cfg);
  const productInputId = `${CONTENT_LANGUAGE}~${FEED_LABEL}~${offerId}`;
  const url =
    `${BASE}/accounts/${cfg.accountId}/productInputs/${encodeURIComponent(productInputId)}` +
    `?dataSource=${encodeURIComponent(`accounts/${cfg.accountId}/dataSources/${cfg.dataSourceId}`)}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (res.ok || res.status === 404) return { ok: true, status: res.status };
  return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
}