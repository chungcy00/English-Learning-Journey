// Vercel serverless entry for POST /api/speech/dialogue.
export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import('../../backend/app.js');
    req.url = '/api/speech/dialogue';
    await new Promise<void>((resolve, reject) => {
      res.once('finish', resolve);
      res.once('error', reject);
      app(req, res);
    });
  } catch (error) {
    if (!res.headersSent) {
      console.error('Backend startup failed:', error);
      res.status(500).json({ error: '服务暂不可用，请稍后重试' });
    }
  }
}
