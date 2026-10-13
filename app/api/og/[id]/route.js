import { ImageResponse } from "next/og";
import { createPublicClient, http, formatUnits } from "viem";
import { CHAIN, CONTRACT, ABI } from "../../../../lib/config";
import { PLAYERS } from "../../../../lib/players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SC = { GK: "#f5c518", DEF: "#2d6cdf", MID: "#1fa65a", FWD: "#e90052" };
const ROWS = [[0], [1, 2], [3, 4], [5]];

export async function GET(_req, { params }) {
  const { id } = await params;
  let s = null, rank = 1, price = 0n;
  try {
    const c = createPublicClient({ chain: CHAIN, transport: http() });
    const rd = (functionName, args) => c.readContract({ address: CONTRACT, abi: ABI, functionName, args });
    const sid = BigInt(id);
    s = await rd("getSquad", [sid]);
    const ids = await rd("getRoundSquads", [s.round]);
    const all = await Promise.all(ids.map(async (i) => ({ id: i, m: (await rd("getSquad", [i])).mints })));
    all.sort((a, b) => b.m - a.m || Number(a.id - b.id));
    rank = all.findIndex((x) => x.id === sid) + 1;
    price = await rd("cardPrice", [sid]);
    if (s.mints === 0) s = null;
  } catch { s = null; }

  const name = s ? s.name : "Squad Cards";
  const pitch = s ? ROWS.map((r) => r.map((i) => PLAYERS[s.players[i]])) : [];
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 800, display: "flex", flexDirection: "column", padding: 40, color: "#fff", background: "linear-gradient(180deg,#4a0a52,#2b0030)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800 }}>{name}</div>
          {s && <div style={{ display: "flex", background: "#00ff85", color: "#38003c", fontSize: 34, fontWeight: 800, padding: "8px 24px", borderRadius: 22 }}>{`Rank #${rank}`}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", flex: 1, marginTop: 24, marginBottom: 20, background: "#0a8f4a", borderRadius: 28, border: "4px solid #ffffff66" }}>
          {pitch.map((row, k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-around" }}>
              {row.map((p) => (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 84, height: 70, borderRadius: 18, fontSize: 38, fontWeight: 800, background: SC[p.pos], color: p.pos === "GK" ? "#38003c" : "#fff" }}>{p.no}</div>
                  <div style={{ display: "flex", marginTop: 6, background: "#fff", color: "#38003c", fontSize: 24, fontWeight: 700, padding: "2px 12px", borderRadius: 10 }}>{p.n}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>{s ? `${s.mints} cards` : "Build a squad. Win the round."}</div>
          <div style={{ display: "flex", color: "#00ff85" }}>{s ? `Next card $${Number(formatUnits(price, 6)).toFixed(2)}` : ""}</div>
          <div style={{ display: "flex", color: "#cdb4d4" }}>Squad Cards · Base</div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 }
  );
}
