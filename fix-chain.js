import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/const ROBUST_MODEL_CHAIN = \[\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'[^']*'\s*\];/, `const ROBUST_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite'
];`);

fs.writeFileSync('server.ts', content);
