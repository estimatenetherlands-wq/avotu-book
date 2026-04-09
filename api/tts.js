import { MsEdgeTTS } from 'edge-tts-node';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, lang } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const tts = new MsEdgeTTS();
    
    // Voices: Dmitry (RU) and Christopher (EN)
    const voice = lang === 'ru' ? 'ru-RU-DmitryNeural' : 'en-US-ChristopherNeural';
    
    // Use a slightly faster bit rate to stay under Vercel's 10s timeout
    await tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3');
    
    // Edge TTS can fail if the text is too long for one request (~10-15s synthesis)
    // We'll try to process it, if it fails, we might need to split it
    const audioBuffer = await tts.toAudioData(text);

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Microsoft servers returned empty audio');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours cache
    res.send(audioBuffer);
  } catch (error) {
    console.error('TTS Error:', error);
    // Return the error message to the frontend for debugging
    res.status(500).json({ error: error.message || 'Unknown TTS error' });
  }
}
