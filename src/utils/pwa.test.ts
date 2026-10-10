import test from 'node:test';
import assert from 'node:assert/strict';
import { manualUpdatePlatform, usesAndroidPhoneBottomNav } from './pwa';

test('iPhone and iPad home-screen websites use the web flow, not manual software updates', () => {
  assert.equal(manualUpdatePlatform(true, true, true), false);
  assert.equal(manualUpdatePlatform(false, true, true), false);
  assert.equal(manualUpdatePlatform(true, true, false), true);
  assert.equal(manualUpdatePlatform(false, true, false), false);
  assert.equal(manualUpdatePlatform(true, false, false), false);
});

test('bottom navigation is exclusive to installed Android phones, never browser tabs or tablets', () => {
  const phone = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
  const tablet = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
  assert.equal(usesAndroidPhoneBottomNav(false, phone), false);
  assert.equal(usesAndroidPhoneBottomNav(true, phone), true);
  assert.equal(usesAndroidPhoneBottomNav(true, tablet), false);
  assert.equal(usesAndroidPhoneBottomNav(false, tablet), false);
  assert.equal(usesAndroidPhoneBottomNav(true, 'iPhone Mobile Safari'), false);
  assert.equal(usesAndroidPhoneBottomNav(true, 'iPad Safari'), false);
  assert.equal(usesAndroidPhoneBottomNav(true, 'Windows NT 10.0 Chrome'), false);
});
