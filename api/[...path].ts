// Vercel Serverless Function catch-all for every /api/* request.
// The Express app contains the actual route definitions and is also used by
// the local development server, so both environments share one API implementation.
export { default } from '../server';
