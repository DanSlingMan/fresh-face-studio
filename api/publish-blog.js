export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug, content, title } = req.body;

  if (!slug || !content || !title) {
    return res.status(400).json({ error: 'Missing required fields: slug, content, title' });
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/DanSlingMan/fresh-face-studio/contents/src/content/blog/${slug}.md`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Add blog post: ${title}`,
          content: Buffer.from(content).toString('base64'),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'GitHub API error' });
    }

    return res.status(200).json({ success: true, path: data.content.path });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to publish blog post' });
  }
}
