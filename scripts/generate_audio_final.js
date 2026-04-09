import fs from 'fs';
import path from 'path';

// TikTok TTS API Endpoint (Unofficial but stable)
const TIKTOK_API = 'https://tiktok-tts.weilbyte.dev/api/generate';

async function generateTikTok(text, voice) {
    const response = await fetch(TIKTOK_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text,
            voice: voice
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`TikTok API error: ${err}`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(`TikTok generation failed: ${data.error}`);
    }

    return Buffer.from(data.data, 'base64');
}

// Helper to split text for TikTok (limit ~300 chars)
function splitIntoChunks(text, maxLength = 250) {
    const chunks = [];
    let currentChunk = "";
    const segments = text.split(/([.!?,\n])/);
    
    for (const segment of segments) {
        if ((currentChunk + segment).length > maxLength) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = segment;
        } else {
            currentChunk += segment;
        }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks;
}

async function generateAll() {
  const settings = [
    { lang: 'ru', voice: 'ru_001' }, // Good Russian Male
    { lang: 'en', voice: 'en_us_006' } // The legendary "Narrator"
  ];
  
  for (const { lang, voice } of settings) {
    console.log(`\n--- Epic TikTok Voices for ${lang.toUpperCase()} ---`);
    const contentDir = path.join(process.cwd(), 'public', 'content', lang);
    const outputDir = path.join(process.cwd(), 'public', 'audio', lang);
    
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 1; i <= 24; i++) {
      const fileName = `chapter-${i}.json`;
      const filePath = path.join(contentDir, fileName);
      const outputPath = path.join(outputDir, `chapter-${i}.mp3`);

      if (fs.existsSync(filePath)) {
        process.stdout.write(`Synthesizing Chapter ${i}... `);
        
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const text = data.paragraphs.filter(p => p !== "***").join(' ');
          
          const chunks = splitIntoChunks(text, 250);
          let allBuffers = [];
          
          for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            if (!chunk) continue;

            let success = false;
            let retries = 3;
            while (!success && retries > 0) {
                try {
                    const buffer = await generateTikTok(chunk, voice);
                    allBuffers.push(buffer);
                    success = true;
                } catch (e) {
                    retries--;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            if (!success) throw new Error(`Failed chunk ${j+1}`);
            
            if (j % 5 === 0) process.stdout.write(`.`);
            await new Promise(r => setTimeout(r, 500)); // Rate limit safety
          }

          fs.writeFileSync(outputPath, Buffer.concat(allBuffers));
          console.log(' ✅');
          
        } catch (err) {
          console.log(` ❌ ${err.message}`);
        }
      }
    }
  }
}

generateAll().then(() => {
  console.log('\n✨ All epic audio tracks generated successfully via TikTok!');
}).catch(err => {
  console.error('\n💥 Critical Error:', err);
});
