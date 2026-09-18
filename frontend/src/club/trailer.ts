const YOUTUBE_ID = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/

export function youtubeId(url: string | null): string | null {
  return url === null ? null : (YOUTUBE_ID.exec(url)?.[1] ?? null)
}

export function trailerEmbed(url: string | null): string | null {
  const id = youtubeId(url)
  return id === null
    ? null
    : `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
}
