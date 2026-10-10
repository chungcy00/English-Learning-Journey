// Device speech event elapsedTime varies between engines. Measure active playback
// locally instead, and derive progress only from confirmed text boundaries/ends.
export function locateDeviceSpeechPosition(chunks: string[], percent: number) {
  const total = chunks.reduce((sum, text) => sum + text.length, 0);
  let charIndex = Math.floor(total * Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0)) / 100);
  let queueIndex = 0;
  let completed = 0;
  while (queueIndex < chunks.length && charIndex >= chunks[queueIndex].length) {
    charIndex -= chunks[queueIndex].length;
    completed += chunks[queueIndex].length;
    queueIndex++;
  }
  const text = chunks[queueIndex];
  if (text) {
    while (charIndex > 0 && /[\p{L}\p{N}'’-]/u.test(text[charIndex]) && /[\p{L}\p{N}'’-]/u.test(text[charIndex - 1])) charIndex--;
  }
  return {queueIndex, charIndex, characters: completed + charIndex};
}

export function createDeviceSpeechProgress(now: () => number = () => performance.now()) {
  let startedAt: number | null = null;
  let elapsedMs = 0;
  let totalCharacters = 0;
  let confirmedCharacters = 0;
  const pause = () => {
    if (startedAt !== null) elapsedMs += Math.max(0, now() - startedAt);
    startedAt = null;
  };
  return {
    reset(characters = 0) {
      startedAt = null;
      elapsedMs = 0;
      totalCharacters = characters;
      confirmedCharacters = 0;
    },
    start() { if (startedAt === null) startedAt = now(); },
    pause,
    boundary(completed: number, charIndex: number, chunkLength: number) {
      if (!Number.isFinite(charIndex) || charIndex < 0 || charIndex > chunkLength) return;
      confirmedCharacters = Math.max(confirmedCharacters, Math.min(totalCharacters, completed + charIndex));
    },
    complete(characters: number) {
      confirmedCharacters = Math.max(confirmedCharacters, Math.min(totalCharacters, characters));
    },
    seek(characters: number) {
      confirmedCharacters = Math.max(0, Math.min(totalCharacters, characters));
    },
    snapshot() {
      return {
        seconds: (elapsedMs + (startedAt === null ? 0 : Math.max(0, now() - startedAt))) / 1000,
        percent: totalCharacters > 0 ? confirmedCharacters / totalCharacters * 100 : 0,
      };
    },
  };
}
