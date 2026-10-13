// Best-effort lookup of a Farcaster username (cosmetic only). Falls back to null.
export async function GET(_req, { params }) {
  const { fid } = await params;
  let username = null;
  if (/^\d+$/.test(fid)) {
    try {
      if (process.env.NEYNAR_API_KEY) {
        const r = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, { headers: { "x-api-key": process.env.NEYNAR_API_KEY } });
        username = (await r.json()).users?.[0]?.username || null;
      } else {
        const r = await fetch(`https://client.warpcast.com/v2/user?fid=${fid}`);
        username = (await r.json()).result?.user?.username || null;
      }
    } catch {}
  }
  return Response.json({ username }, { headers: { "Cache-Control": "s-maxage=3600" } });
}
