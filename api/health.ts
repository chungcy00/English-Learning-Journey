// Native Vercel Function for GET /api/health. It intentionally has no backend
// imports, so it can also diagnose whether the Function runtime itself works.
export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: ['GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3'].some(name=>Boolean(process.env[name]?.trim())),
    geminiKeyCount: new Set(['GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3'].map(name=>process.env[name]?.trim()).filter(Boolean)).size,
    speechProvider: 'device',
  });
}
