import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';

test('compiled serverless backend starts under native Node ESM resolution', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const output = await mkdtemp(path.join(tmpdir(), 'english-serverless-'));
  const visited = new Set<string>();
  async function compile(relative: string) {
    if (visited.has(relative)) return;
    visited.add(relative);
    const source = await readFile(path.join(root, relative.replace(/\.js$/, '.ts')), 'utf8');
    const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, result);
    for (const match of result.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      assert.ok(match[1].endsWith('.js'), `Native ESM requires an extension: ${relative} → ${match[1]}`);
      await compile(path.posix.join(path.posix.dirname(relative), match[1]));
    }
  }
  try {
    await writeFile(path.join(output, 'package.json'), '{"type":"module"}');
    await symlink(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
    await compile('backend/app.js');
    const target = pathToFileURL(path.join(output, 'backend/app.js')).href;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `const {default:app}=await import(${JSON.stringify(target)});if(typeof app!=='function')process.exit(1);console.log('native-backend-ready');`], { cwd: output });
    assert.match(stdout, /native-backend-ready/);
  } finally { await rm(output, { recursive: true, force: true }); }
});
