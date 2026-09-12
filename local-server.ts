import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app from './backend/app.js';

const PORT = Number(process.env.PORT) || 3000;

// Local development/standalone production runner. Vercel Functions import
// backend/app.ts directly and never load this Vite or port-listener code.
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
