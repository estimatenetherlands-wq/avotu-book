
export default async function handler(req, res) {
  const { action, key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  // Force Vercel to NOT cache this response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const namespace = "avotu_final_2026_v4";
  const baseUrl = `https://api.counterapi.dev/v1/${namespace}/${key}`;
  const targetUrl = action === 'increment' ? `${baseUrl}/increment` : baseUrl;

  try {
    const response = await fetch(targetUrl, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
        return res.status(200).json({ count: 0 });
    }

    const data = await response.json();
    return res.status(200).json({ count: data.count || 0 });
  } catch (error) {
    console.error('API Stats Error:', error);
    return res.status(200).json({ count: 0 });
  }
}
