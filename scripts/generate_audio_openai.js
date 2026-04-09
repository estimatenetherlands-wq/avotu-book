import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateAll() {
  const langs = ['ru', 'en'];
  
  for (const lang of langs) {
    console.log(`\n--- Generating high-quality OpenAI audio for ${lang.toUpperCase()} ---`);
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
          const text = data.paragraphs.filter(p => p !== "***").join('\n\n');
          
          // OpenAI limit is 4096 chars.
          // For safety, let's split into chunks of ~3500 chars.
          const textChunks = [];
          for (let start = 0; start < text.length; start += 3500) {
            textChunks.push(text.substring(start, start + 3500));
          }

          let allBuffers = [];
          
          for (const chunk of textChunks) {
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "onyx",
                input: chunk,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            allBuffers.push(buffer);
            process.stdout.write('.');
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
  console.log('\n✨ All high-quality audio tracks generated with OpenAI!');
}).catch(err => {
  console.error('\n💥 Fatal Error:', err);
});
