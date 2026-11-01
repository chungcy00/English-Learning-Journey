import { AiDeadlineError } from './aiDeadline.js';

export class GenerationContractError extends Error {
  constructor() { super('Generated result did not satisfy the reading contract'); this.name = 'GenerationContractError'; }
}

// Never expose upstream error bodies (which can include request data or keys).
export function generationFailure(error: unknown): { status: number; code: string; error: string } {
  const value = error as { message?: string; status?: number; code?: string } | null;
  const message = value?.message || '';
  if (error instanceof AiDeadlineError) return { status: 504, code: 'GENERATION_TIMEOUT', error: '短文生成超时，请稍后重试。你的输入和已有短文已保留。' };
  if (message.includes('GEMINI_API_KEY')) return { status: 503, code: 'GENERATION_NOT_CONFIGURED', error: '短文生成服务尚未配置，请联系维护者。' };
  if (value?.status === 429 || /RESOURCE_EXHAUSTED|Quota exceeded|exceeded your current quota/i.test(message)) return { status: 429, code: 'GENERATION_PROVIDER_LIMIT', error: 'AI 服务当前额度受限，请稍后重试。你的输入已保留。' };
  if (value?.status === 503 || /UNAVAILABLE|high demand/i.test(message)) return { status: 503, code: 'GENERATION_BUSY', error: 'AI 服务暂时繁忙，请稍后重试。你的输入已保留。' };
  if (error instanceof GenerationContractError || error instanceof SyntaxError) return { status: 502, code: 'GENERATION_INVALID_RESULT', error: 'AI 返回的短文或配套练习不完整，暂时无法保存，请重试。你的输入已保留。' };
  if (error instanceof TypeError || /fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(`${message} ${value?.code || ''}`)) return { status: 502, code: 'GENERATION_CONNECTION_FAILED', error: '服务器未能连接 AI 服务，请稍后重试。你的输入已保留。' };
  return { status: 500, code: 'GENERATION_FAILED', error: '短文生成遇到问题，请稍后重试。你的输入已保留。' };
}
