
export default async function handler(req, res) {
  const { action, key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  // Use a fresh namespace to ensure clean start
  const namespace = "avotu_v3_stats";
  const baseUrl = `https://api.counterapi.dev/v1/${namespace}/${key}`;
  const targetUrl = action === 'increment' ? `${baseUrl}/increment` : baseUrl;

  try {
    const response = await fetch(targetUrl, { 
      cache: 'no-store',
      headers: {
        'pragma': 'no-cache',
        'cache-control': 'no-cache'
      }
    });
    const data = await response.json();
    
    if (data.code && data.code !== 200) {
        return res.status(200).json({ count: 0 });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Stats Error:', error);
    return res.status(200).json({ count: 0 });
  }
}
