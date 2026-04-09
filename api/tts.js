import { MsEdgeTTS } from 'edge-tts-node';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, lang } = req.body;

  try {
    const tts = new MsEdgeTTS();
    
    // Choose professional neural voices
    const voice = lang === 'ru' ? 'ru-RU-DmitryNeural' : 'en-US-ChristopherNeural';
    
    await tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3');
    
    // Split text into smaller chunks if it's too long (Edge TTS has limits per request)
    // For a single chapter, we can try to send it as one or split by paragraphs
    const audioBuffer = await tts.toAudioData(text);

    if (!audioBuffer) {
      throw new Error('Failed to generate audio data');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(audioBuffer);
  } catch (error) {
    console.error('Edge TTS Error:', error);
    res.status(500).json({ error: error.message });
  }
}
