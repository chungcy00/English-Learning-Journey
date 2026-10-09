/** Gemini 3.1 TTS returns headerless signed 16-bit little-endian PCM. */
export function browserDialogueAudio(data: string, mimeType = 'audio/l16;rate=24000', sampleRate?: number): Buffer {
  const audio = Buffer.from(data, 'base64');
  if (!audio.length) throw new Error('TTS_EMPTY_AUDIO');
  if (/^audio\/(?:wav|wave|x-wav)(?:;|$)/i.test(mimeType)) {
    if (audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('TTS_INVALID_WAV');
    }
    return audio;
  }
  if (!/^audio\/l16(?:;|$)/i.test(mimeType)) throw new Error('TTS_UNSUPPORTED_AUDIO');
  const rate = sampleRate ?? Number(mimeType.match(/(?:^|;)\s*rate\s*=\s*(\d+)/i)?.[1] ?? 24000);
  const channels = Number(mimeType.match(/(?:^|;)\s*channels\s*=\s*(\d+)/i)?.[1] ?? 1);
  if (!Number.isInteger(rate) || rate < 8000 || rate > 96000 ||
      !Number.isInteger(channels) || channels < 1 || channels > 2 || audio.length % (channels * 2)) {
    throw new Error('TTS_INVALID_PCM');
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + audio.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(audio.length, 40);
  return Buffer.concat([header, audio]);
}
