import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {productionHeadStatus,ignoredBuildCommand}=require('../scripts/productionHead.cjs');
const sha='a'.repeat(40),next='b'.repeat(40);
const env={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',VERCEL_GIT_COMMIT_SHA:sha};
test('stale production commits are rejected while the current head is allowed',()=>{
 assert.equal(productionHeadStatus(env,()=>`${sha}\trefs/heads/main\n`),'current');
 assert.equal(productionHeadStatus(env,()=>`${next}\trefs/heads/main\n`),'stale');
});
test('local and preview builds make no remote request; unverifiable production checks cannot authorize promotion',()=>{
 const noNetwork=()=>{throw new Error('must not run')};
 assert.equal(productionHeadStatus({},noNetwork),'skip');assert.equal(productionHeadStatus({...env,VERCEL_ENV:'preview'},noNetwork),'skip');
 assert.equal(productionHeadStatus(env,noNetwork),'unverified');assert.equal(productionHeadStatus(env,()=>''),'unverified');
});
test('project ignore step uses a self-contained command, including for old commits without the guard file',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.ignoreCommand,ignoredBuildCommand);assert.ok(!ignoredBuildCommand.includes('require(\'./scripts/'));
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));assert.ok(pkg.scripts.build.endsWith('node scripts/productionHead.cjs'));
});
test('the shell-quoted ignore command preserves preview builds without a syntax error',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync('sh',['-c',ignoredBuildCommand],{env:{...process.env,VERCEL_ENV:'preview'},encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stderr,'');
});
