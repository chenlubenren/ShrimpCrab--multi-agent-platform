const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#101010"/>
  <rect x="8" y="8" width="48" height="48" fill="#3b5fa8"/>
  <rect x="16" y="16" width="12" height="12" fill="#f7f2df"/>
  <rect x="36" y="16" width="12" height="12" fill="#f7f2df"/>
  <rect x="16" y="36" width="12" height="12" fill="#f7f2df"/>
  <rect x="36" y="36" width="12" height="12" fill="#f7f2df"/>
</svg>`;

export function GET() {
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
