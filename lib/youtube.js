// Extracts the video id from youtube.com/watch?v=, youtube.com/shorts/, youtu.be/ and youtube.com/embed/ links
export function getYouTubeId(url) {
  if (!url || typeof url !== "string") return null
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
  ]
  for (const pattern of patterns) {
    const match = url.trim().match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getYouTubeEmbedHtml(videoId) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>html,body{margin:0;padding:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoId}?playsinline=1&autoplay=1&rel=0"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
  </body>
</html>`
}
