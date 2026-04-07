
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { action, key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  // Force Vercel to NOT cache this response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    if (action === 'increment') {
      // Use hincrby to store all chapter stats in one hash map or just use simple keys
      // For simplicity and maximum compatibility, we use simple keys with a prefix
      const currentCount = await kv.incr(`avotu_stats_${key}`);
      return res.status(200).json({ count: currentCount });
    } else {
      // Get current count
      const count = await kv.get(`avotu_stats_${key}`);
      return res.status(200).json({ count: count || 0 });
    }
  } catch (error) {
    console.error('Vercel KV Error:', error);
    // Fallback if KV is not connected yet (returns 0 instead of crashing)
    return res.status(200).json({ count: 0, warning: 'Storage not connected' });
  }
}
