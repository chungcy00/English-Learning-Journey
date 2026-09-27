import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { QUOTA_SCRIPT } from './aiQuota';

// Optional Lua VM for executing the exact production script without credentials.
// AI_QUOTA_LUA_RUNTIME=/absolute/path/to/node_modules/fengari
const runtime = process.env.AI_QUOTA_LUA_RUNTIME;
test('production Lua: limits, shared counters, rejection rollback and UTC resets', { skip: !runtime }, () => {
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = createRequire(import.meta.url)(runtime!);
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const harness = `
local now = 172800
local records = {}
redis = { call = function(command, key, ...)
  local args = {...}
  if command == 'TIME' then return {tostring(now), '0'} end
  if command == 'HMGET' then local r = records[key] or {}; return {r.bucket or false, r.count or false} end
  if command == 'HSET' then records[key] = {bucket=args[2], count=args[4]}; return 1 end
  if command == 'EXPIRE' then assert(args[1] > 0); return 1 end
  error('Unexpected command: '..command)
end }
local reserve = assert(load(${JSON.stringify(QUOTA_SCRIPT)}))
local function request(ip, speech, globalLimit)
  KEYS = {'global', ip..':minute', ip..':day'}
  ARGV = {globalLimit or 100, 86400, 5, 60, 30, 86400}
  if speech then
    KEYS[4] = 'speech-global'; KEYS[5] = ip..':speech'
    ARGV[7] = 10; ARGV[8] = 86400; ARGV[9] = 3; ARGV[10] = 86400
  end
  return reserve()
end
for i=1,5 do assert(request('a')[1] == 1) end
local denied = request('a')
assert(denied[1] == 0 and denied[2] == 2 and denied[3] == 60)
assert(records.global.count == 5)
now = now+60
assert(request('a')[1] == 1)
assert(records['a:minute'].count == 1 and records['a:day'].count == 6)
-- Many callers use exactly the same global state, as separate Vercel instances do.
local accepted = 6
for i=1,250 do if request('new-ip-'..i)[1] == 1 then accepted = accepted+1 end end
assert(accepted == 100 and records.global.count == 100)
assert(request('different-ip')[2] == 1)
now = 259200
assert(request('a')[1] == 1)
assert(records.global.count == 1 and records['a:day'].count == 1)
for i=1,3 do assert(request('speech-ip', true)[1] == 1) end
assert(request('speech-ip', true)[2] == 5)
assert(records.global.count == 4 and records['speech-global'].count == 3)
for i=1,7 do assert(request('speaker-'..i, true)[1] == 1) end
assert(request('speaker-new', true)[2] == 4)
assert(records.global.count == 11)
-- IP daily cap across minute resets.
for i=1,30 do now=now+60; assert(request('daily-ip')[1] == 1) end
now=now+60
assert(request('daily-ip')[2] == 3)
assert(records.global.count == 41)
assert(request('emergency', false, 0)[2] == 1)
`;
  try {
    const status = lauxlib.luaL_dostring(state, to_luastring(harness));
    const error = status === lua.LUA_OK ? '' : to_jsstring(lua.lua_tostring(state, -1));
    assert.equal(status, lua.LUA_OK, error);
  } finally { lua.lua_close(state); }
});
