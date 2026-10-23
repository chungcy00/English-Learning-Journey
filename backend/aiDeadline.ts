export class AiDeadlineError extends Error {
  constructor() { super('翻译请求超时，请稍后重试。已有译文不会被清除。'); this.name = 'AiDeadlineError'; }
}
export async function withAiDeadline<T>(milliseconds: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (milliseconds <= 0) throw new AiDeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new AiDeadlineError()); controller.abort(); }, milliseconds);
  });
  try { return await Promise.race([Promise.resolve().then(() => run(controller.signal)), expired]); }
  finally { clearTimeout(timer!); }
}
