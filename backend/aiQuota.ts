import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, Response, NextFunction } from 'express';

type Env = Record<string, string | undefined>;
export class AiQuotaError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter = 60) {
    super(message);
  }
}
const unavailable = () => new AiQuotaError(503, 'AI_QUOTA_UNAVAILABLE', '额度保护暂不可用，AI 服务已暂停，请稍后重试。');
const context = new AsyncLocalStorage<string>();

// IPv6 privacy addresses in the same /64 share a quota. Never store raw IPs.
export function normalizeIp(value: string): string {
  const ip = value.trim().toLowerCase();
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6 || ip.includes('%')) throw unavailable();
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right = ''] = canonical.split('::');
  const a = left ? left.split(':') : [];
  const b = right ? right.split(':') : [];
  const parts = canonical.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  const numbers = parts.map(part => parseInt(part, 16));
  if (numbers.slice(0, 5).every(n => n === 0) && numbers[5] === 65535) {
    return [numbers[6] >> 8, numbers[6] & 255, numbers[7] >> 8, numbers[7] & 255].join('.');
  }
  return `${numbers.slice(0, 4).map(n => n.toString(16)).join(':')}::/64`;
}

export function clientIp(req: Pick<Request, 'headers' | 'socket'>, env: Env): string {
  // Only trust the header on Vercel, which overwrites it at the edge.
  // Local/other hosts use the socket; arbitrary X-Forwarded-For cannot bypass limits.
  const value = env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] : req.socket.remoteAddress;
  if (typeof value !== 'string' || value.includes(',')) throw unavailable();
  return normalizeIp(value);
}

export function quotaContext(req: Request, res: Response, next: NextFunction) {
  try { context.run(clientIp(req, process.env), next); }
  catch (error) { sendQuotaError(res, error instanceof AiQuotaError ? error : unavailable()); }
}

// Redis TIME supplies a single clock across all routes/regions/deployments.
// Check every limit before updating any counter. A rejected reservation costs
// no AI units; concurrent reservations cannot overshoot the configured limits.
export const QUOTA_SCRIPT = `
local now = tonumber(redis.call('TIME')[1])
local counts = {}
local buckets = {}
local retries = {}
for i, key in ipairs(KEYS) do
  local limit = tonumber(ARGV[(i-1)*2+1])
  local window = tonumber(ARGV[(i-1)*2+2])
  local bucket = math.floor(now / window)
  local record = redis.call('HMGET', key, 'bucket', 'count')
  local count = 0
  if tonumber(record[1]) == bucket then count = tonumber(record[2]) or 0 end
  counts[i] = count
  buckets[i] = bucket
  retries[i] = window - (now % window)
  if count >= limit then return {0, i, retries[i]} end
end
for i, key in ipairs(KEYS) do
  redis.call('HSET', key, 'bucket', buckets[i], 'count', counts[i]+1)
  redis.call('EXPIRE', key, retries[i]+1)
end
return {1, 0, 0}
`;

function limit(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw unavailable();
  const result = Number(raw);
  if (!Number.isSafeInteger(result) || result > 1000000) throw unavailable();
  return result; // Zero is an intentional emergency stop, never unlimited.
}

export async function reserveQuota(ip: string, kind: 'text' | 'speech', env: Env = process.env, fetcher: typeof fetch = fetch) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const salt = env.AI_RATE_LIMIT_SALT;
  if (!url || !token || !salt || salt.length < 32) throw unavailable();
  let endpoint: URL;
  try { endpoint = new URL(url); } catch { throw unavailable(); }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw unavailable();
  const hash = createHmac('sha256', salt).update(normalizeIp(ip.replace(/::\/64$/, '::'))).digest('hex');
  const prefix = 'mine-english:{ai-quota}:v1';
  const buckets: [string, number, number, string][] = [
    [`${prefix}:global:day`, limit(env, 'AI_GLOBAL_DAILY_LIMIT', 100), 86400, '全站今日 AI 额度已用完，请明日再试。'],
    [`${prefix}:ip:${hash}:minute`, limit(env, 'AI_IP_MINUTE_LIMIT', 5), 60, '当前网络请求过于频繁，请稍后再试。'],
    [`${prefix}:ip:${hash}:day`, limit(env, 'AI_IP_DAILY_LIMIT', 30), 86400, '当前网络今日 AI 额度已用完，请明日再试。'],
  ];
  if (kind === 'speech') buckets.push(
    [`${prefix}:speech:day`, limit(env, 'AI_SPEECH_GLOBAL_DAILY_LIMIT', 10), 86400, '全站今日云端语音额度已用完，仍可使用设备语音。'],
    [`${prefix}:speech:${hash}:day`, limit(env, 'AI_SPEECH_IP_DAILY_LIMIT', 3), 86400, '当前网络今日云端语音额度已用完，仍可使用设备语音。'],
  );
  try {
    const response = await fetcher(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', QUOTA_SCRIPT, buckets.length, ...buckets.map(b => b[0]), ...buckets.flatMap(b => [b[1], b[2]])]),
    });
    if (!response.ok) throw unavailable();
    const data = await response.json();
    const result = data?.result;
    if (data?.error || !Array.isArray(result) || result.length !== 3) throw unavailable();
    if (result[0] === 1 && result[1] === 0 && result[2] === 0) return;
    if (result[0] !== 0 || !Number.isInteger(result[1]) || !buckets[result[1] - 1] || !Number.isInteger(result[2]) || result[2] < 1 || result[2] > 86400) throw unavailable();
    throw new AiQuotaError(429, 'AI_QUOTA_EXCEEDED', buckets[result[1] - 1][3], result[2]);
  } catch (error) {
    if (error instanceof AiQuotaError) throw error;
    throw unavailable(); // Never retry or fail open after uncertain reservations.
  }
}

export async function consumeAiQuota(kind: 'text' | 'speech') {
  const ip = context.getStore();
  if (!ip) throw unavailable();
  await reserveQuota(ip, kind);
}

export function sendQuotaError(res: Response, error: unknown): boolean {
  if (!(error instanceof AiQuotaError)) return false;
  res.setHeader('Retry-After', String(error.retryAfter));
  res.setHeader('Cache-Control', 'no-store');
  res.status(error.status).json({ code: error.code, error: error.message, retryAfter: error.retryAfter });
  return true;
}
