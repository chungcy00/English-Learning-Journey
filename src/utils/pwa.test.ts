import test from 'node:test';
import assert from 'node:assert/strict';
import { manualUpdatePlatform, usesBottomNavigation } from './pwa';

test('iPhone and iPad home-screen websites use the web flow, not manual software updates', () => {
  assert.equal(manualUpdatePlatform(true, true, true), false);
  assert.equal(manualUpdatePlatform(false, true, true), false);
  assert.equal(manualUpdatePlatform(true, true, false), true);
  assert.equal(manualUpdatePlatform(false, true, false), false);
  assert.equal(manualUpdatePlatform(true, false, false), false);
});

test('phones and tablets use bottom navigation in browsers and installed shells; desktop keeps its header', () => {
  assert.equal(usesBottomNavigation(375, true), true);
  assert.equal(usesBottomNavigation(768, true), true);
  assert.equal(usesBottomNavigation(1366, true), true);
  assert.equal(usesBottomNavigation(1366, false, true), true);
  assert.equal(usesBottomNavigation(975, false), true);
  assert.equal(usesBottomNavigation(1024, false), false);
  assert.equal(usesBottomNavigation(1440, false), false);
});
