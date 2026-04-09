import fs from 'fs';
import path from 'path';
import { MsEdgeTTS } from 'edge-tts-node';

async function generateAll() {
  const langs = ['ru', 'en'];
  
  // Custom headers to avoid being blocked
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edge/120.0.0.0',
      'Origin': 'chrome-extension://jdicclhfbloidhojdbhlakegjhcidhen',
    }
  };

  const tts = new MsEdgeTTS(options);
  
  for (const lang of langs) {
    console.log(`\n--- Processing ${lang.toUpperCase()} chapters ---`);
    const contentDir = path.join(process.cwd(), 'public', 'content', lang);
    const outputDir = path.join(process.cwd(), 'public', 'audio', lang);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const voice = lang === 'ru' ? 'ru-RU-DmitryNeural' : 'en-US-ChristopherNeural';
    
    // Iterate 24 chapters
    for (let i = 1; i <= 24; i++) {
        const fileName = `chapter-${i}.json`;
        const filePath = path.join(contentDir, fileName);
        const outputPath = path.join(outputDir, `chapter-${i}.mp3`);

        if (fs.existsSync(filePath)) {
            process.stdout.write(`Generating ${fileName}... `);
            try {
                // Set metadata afresh for each chapter to keep connection alive or re-init
                await tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3');

                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const text = data.paragraphs.filter(p => p !== "***").join('\n\n');
                
                const stream = tts.toStream(text);
                const chunks = [];
                for await (const chunk of stream) {
                    if (Buffer.isBuffer(chunk)) {
                        chunks.push(chunk);
                    } else if (typeof chunk === 'string') {
                        chunks.push(Buffer.from(chunk, 'utf8'));
                    }
                }
                const audioBuffer = Buffer.concat(chunks);
                
                if (audioBuffer.length < 100) {
                   throw new Error("Audio buffer too small, likely failed synthesis");
                }

                fs.writeFileSync(outputPath, audioBuffer);
                console.log('✅ Done');
                
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                const msg = err?.message || String(err) || 'Unknown Error';
                console.error(`❌ Error on ${fileName}:`, msg);
                if (msg.includes('Connect Error')) {
                    console.log('Waiting 5s before next attempt...');
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }
    }
  }
}

generateAll().then(() => {
  console.log('\n✨ All audio tracks processed!');
}).catch(err => {
  console.error('\n💥 Critical Error:', err);
});
