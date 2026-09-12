// Vercel Function for POST /api/reading/generate.
export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import('../../backend/app.js');
    req.url = '/api/reading/generate';
    await new Promise<void>((resolve, reject) => {
      res.once('finish', resolve);
      res.once('error', reject);
      app(req, res);
    });
  } catch (error) {
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Backend startup failed: ${message}` });
    }
  }
}
