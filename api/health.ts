// Native Vercel Function for GET /api/health. It intentionally has no backend
// imports, so it can also diagnose whether the Function runtime itself works.
export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY?.trim(),
  });
}
