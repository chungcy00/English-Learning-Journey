// Native Vercel Function for GET /api/health. It intentionally has no backend
// imports, so it can also diagnose whether the Function runtime itself works.
export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    speechProviders: {
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
      googleCloud: Boolean(
        process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON?.trim() ||
        process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_BASE64?.trim() ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
      ),
      azure: Boolean(
        process.env.AZURE_SPEECH_KEY?.trim() && process.env.AZURE_SPEECH_REGION?.trim()
      ),
    },
  });
}
