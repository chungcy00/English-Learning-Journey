/** Preserve server error metadata without presenting provider internals to readers. */
export function dialogueSpeechError(status: number, body: unknown, retryAfter: string | null): Error {
  const payload = body as { error?: unknown; code?: unknown } | null;
  const serverMessage = typeof payload?.error === 'string' &&
    payload.error.length <= 160 && !payload.error.trim().startsWith('{')
    ? payload.error : null;
  const message = serverMessage || (status === 429
    ? '角色语音服务暂时繁忙，请稍后重试。'
    : `角色语音暂时无法生成，请稍后重试（HTTP ${status}）。`);
  const seconds = Number(retryAfter);
  return Object.assign(new Error(message), {
    status,
    code: typeof payload?.code === 'string' ? payload.code : 'TTS_REQUEST_FAILED',
    retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
  });
}
