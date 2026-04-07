
export default async function handler(req, res) {
  const { action, key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Key is required' });
  }

  // Use CounterAPI.dev from the server side to bypass CORS
  const baseUrl = `https://api.counterapi.dev/v1/avotu-saga-prod/${key}`;
  const targetUrl = action === 'increment' ? `${baseUrl}/increment` : baseUrl;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}
