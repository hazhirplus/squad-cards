"use client";
import { useCallback, useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useAccount, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { ABI, ERC20_ABI, CONTRACT, USDC, CHAIN, IS_MAINNET, BASE_PRICE, POS, ROWS } from "../lib/config";
import { PLAYERS } from "../lib/players";
import { RULES_HTML } from "../lib/rulesHtml";
import { shareText } from "../lib/shareTexts";

const SC = { GK: "#f5c518", DEF: "#2d6cdf", MID: "#1fa65a", FWD: "#e90052" };
const usd = (x) => Number(formatUnits(BigInt(x), 6));
const fm = (x) => "$" + usd(x).toFixed(2);
const canon = (s) => [s[0], ...[s[1], s[2]].sort((a, b) => a - b), ...[s[3], s[4]].sort((a, b) => a - b), s[5]];
const safe = (f) => { try { return f(); } catch { return null; } };

function Shirt({ p }) {
  return (
    <svg className="shirt" viewBox="0 0 60 50">
      <path d="M22 4 10 9 3 19l8 5v22h38V24l8-5-7-10-12-5c-3 5-14 5-17 0z" fill={SC[p.pos]} stroke="#00000066" strokeWidth="2" />
      <text x="30" y="35" textAnchor="middle" fontSize="17" fontWeight="800" fill={p.pos === "GK" ? "#38003c" : "#fff"}>{p.no}</text>
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState("build");
  const [slots, setSlots] = useState([null, null, null, null, null, null]);
  const [name, setName] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState("");
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [inApp, setInApp] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState("");

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const pc = usePublicClient({ chainId: CHAIN.id });

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  useEffect(() => {
    (async () => {
      try {
        const ctx = await sdk.context;
        if (!ctx?.user) throw new Error("no user");
        setUser(ctx.user);
      } catch { setInApp(false); }
      finally { sdk.actions.ready(); }
    })();
    if (!safe(() => localStorage.getItem("seen"))) { setModal({ type: "welcome" }); safe(() => localStorage.setItem("seen", "1")); }
    safe(() => { if (new URLSearchParams(window.location.search).get("squad")) setTab("top"); });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (!isConnected && connectors[0]) connect({ connector: connectors[0] }); }, [isConnected, connectors]);

  const read = useCallback((functionName, args) => pc.readContract({ address: CONTRACT, abi: ABI, functionName, args }), [pc]);

  const load = useCallback(async () => {
    if (!CONTRACT || !pc) return;
    try {
      const [round, end] = await Promise.all([read("currentRound"), read("roundEnd")]);
      const [ids, total, leaderId] = await Promise.all([read("getRoundSquads", [round]), read("roundTotal", [round]), read("leader", [round])]);
      const squads = await Promise.all(ids.map(async (id) => {
        const s = await read("getSquad", [id]);
        const price = await read("cardPrice", [id]);
        const owned = user ? await read("hasCard", [id, BigInt(user.fid)]) : false;
        return { id, ...s, price, owned };
      }));
      const claims = [];
      if (address) for (let r = Math.max(1, Number(round) - 5); r < Number(round); r++) {
        const a = await read("pendingClaim", [BigInt(r), address]);
        if (a > 0n) claims.push({ r, a });
      }
      setData({ round, end: Number(end), total, leaderId, squads, claims });
    } catch (e) { console.error(e); }
  }, [pc, read, user, address]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function ensureChain() { if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id }); }
  async function ensureAllowance(amount) {
    const al = await pc.readContract({ address: USDC, abi: ERC20_ABI, functionName: "allowance", args: [address, CONTRACT] });
    if (al >= amount) return;
    const bal = await pc.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] });
    if (bal < amount) throw new Error("Not enough USDC in your wallet");
    const h = await writeContractAsync({ address: USDC, abi: ERC20_ABI, functionName: "approve", args: [CONTRACT, amount], chainId: CHAIN.id });
    await pc.waitForTransactionReceipt({ hash: h });
  }
  async function getAuth() {
    const { token } = await sdk.quickAuth.getToken();
    const res = await fetch("/api/sign", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Could not verify your Farcaster account");
    return j;
  }
  async function send(functionName, args) {
    const hash = await writeContractAsync({ address: CONTRACT, abi: ABI, functionName, args, chainId: CHAIN.id });
    await pc.waitForTransactionReceipt({ hash });
  }
  async function run(label, fn) {
    setBusy(label);
    try { await fn(); await load(); } catch (e) { toast(e.shortMessage || e.message || "Something went wrong"); }
    finally { setBusy(""); }
  }
  const guard = (fn) => { if (safe(() => localStorage.getItem("ack"))) fn(); else setModal({ type: "consent", fn }); };

  const register = () => run("Registering squad…", async () => {
    await ensureChain(); await ensureAllowance(BASE_PRICE);
    const a = await getAuth();
    await send("createSquad", [name.trim(), canon(slots), BigInt(a.fid), BigInt(a.deadline), a.signature]);
    setModal({ type: "done", n: Math.floor(Math.random() * 100) });
  });
  const mint = (sq) => run("Minting card…", async () => {
    await ensureChain(); await ensureAllowance(sq.price);
    const a = await getAuth();
    await send("mint", [sq.id, BigInt(a.fid), BigInt(a.deadline), a.signature]);
    let by = "";
    try { const j = await (await fetch(`/api/user/${sq.creatorFid}`)).json(); if (j.username) by = j.username; } catch {}
    setModal({ type: "minted", id: sq.id, n: Math.floor(Math.random() * 100), by });
  });
  const claim = (r) => run("Claiming…", async () => { await ensureChain(); await send("claim", [BigInt(r)]); toast("Claimed!"); });
  const finalize = () => run("Ending round…", async () => { await ensureChain(); await send("finalizeRound", []); });
  const doShare = (text, id) => sdk.actions.composeCast({ text, embeds: [`${window.location.origin}/share/${id}`] });

  if (!inApp) return <div id="app"><div className="card">Please open this mini app inside Farcaster.</div></div>;
  if (!CONTRACT) return <div id="app"><div className="card">Contract address is not configured yet.</div></div>;

  const squads = data ? [...data.squads].sort((a, b) => b.mints - a.mints || Number(a.id - b.id)) : [];
  const leaderSq = data && squads.find((s) => s.id === data.leaderId);
  const secs = data ? Math.max(0, Math.floor((data.end * 1000 - now) / 1000)) : 0;
  const ended = data && secs === 0;
  const cd = `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`;
  const dup = slots.every((x) => x !== null) && squads.find((s) => canon(slots).join() === s.players.join());
  const full = slots.every((x) => x !== null);
  const mySquad = user && squads.find((s) => s.creatorFid === BigInt(user.fid));
  const mult = leaderSq ? 1 + (0.75 * (usd(data.total) - usd(leaderSq.paid))) / usd(leaderSq.paid) : 1;

  function openPick(i) { if (!mySquad) setModal({ type: "pick", i }); }
  function setP(id) { const n = [...slots]; n[modal.i] = id; setSlots(n); setModal(null); }

  const Slot = ({ i }) => {
    const p = slots[i] !== null ? PLAYERS[slots[i]] : null;
    return (
      <div className="slot" onClick={() => openPick(i)}>
        {p ? (<><Shirt p={p} /><div className="tag">{p.n}</div></>) : (<><div className="empty">+</div><div className="pos">{POS[i]}</div></>)}
      </div>
    );
  };

  return (
    <div id="app">
      {!IS_MAINNET && <div className="testnet">TESTNET — Base Sepolia · no real money</div>}
      {busy && <div className="demo">{busy}</div>}

      {tab === "build" && (<>
        <h1>Build Your Squad</h1>
        <p className="sub">Pick 6 players, register for $0.10 and get card #1 of your squad.</p>
        <input placeholder="Squad name" maxLength={24} value={name} disabled={!!mySquad} onChange={(e) => setName(e.target.value)} />
        <div className="pitch">{ROWS.map((r, k) => <div className="row" key={k}>{r.map((i) => <Slot i={i} key={i} />)}</div>)}</div>
        {dup && <div className="card" style={{ marginTop: 10, borderColor: "var(--pink)" }}>⚠️ This exact squad already exists in this round (“{dup.name}”). Change at least one player.</div>}
        {mySquad
          ? <button className="btn alt" onClick={() => setTab("top")}>You already have a squad this round — view leaderboard</button>
          : <button className="btn" disabled={!full || !name.trim() || !!dup || !!busy || ended} onClick={() => guard(register)}>Register Squad · $0.10 USDC</button>}
      </>)}

      {tab === "top" && (<>
        <h1>Top Squads</h1>
        <p className="sub">Round {data ? String(data.round) : "…"} · the squad with the most cards wins and is paid from the losing squads.</p>
        {data && <div className="card pool">
          <span className="mt" style={{ color: "#fff" }}>Total pool (all payments)</span><b>{fm(data.total)}</b>
          {ended ? <button className="btn sm" style={{ marginTop: 10, background: "#fff", color: "#38003c" }} disabled={!!busy} onClick={finalize}>Round over — start next round</button>
            : <span className="mt" style={{ color: "#fff" }}>Ends in {cd}</span>}
          {leaderSq && <div className="mt" style={{ color: "#fff", marginTop: 6 }}>If “{leaderSq.name}” wins now: holders get ≈ {mult.toFixed(2)}× what they paid (never below 1×)</div>}
        </div>}
        {data && squads.length === 0 && <div className="card">No squads yet this round — be the first to register!</div>}
        {squads.map((s, i) => (
          <div className="card sq" key={String(s.id)}>
            <div className={"rank " + (data.leaderId === s.id ? "one" : "")}>{data.leaderId === s.id ? "♛" : i + 1}</div>
            <div className="grow">
              <div className="nm">{s.name}</div>
              <div className="mt">by FID {String(s.creatorFid)}</div>
              <div className="mt">{s.players.map((p) => PLAYERS[p].n).join(" · ")}</div>
            </div>
            <div>
              <div className="mints">{s.mints}<small>cards</small></div>
              {s.owned ? <button className="btn sm" disabled>Owned ✓</button>
                : <button className="btn sm" disabled={!!busy || ended} onClick={() => guard(() => mint(s))}>Mint {fm(s.price)}</button>}
            </div>
          </div>
        ))}
      </>)}

      {tab === "earn" && (<>
        <h1>My Wallet</h1>
        <p className="sub">{address ? address.slice(0, 6) + "…" + address.slice(-4) : "Connecting…"}</p>
        <div className="card"><b>Prizes to claim</b>
          {data && data.claims.length ? data.claims.map((c) => (
            <div className="sq" key={c.r} style={{ marginTop: 8 }}>
              <div className="grow nm">Round {c.r} · {fm(c.a)}</div>
              <button className="btn sm" disabled={!!busy} onClick={() => claim(c.r)}>Claim</button>
            </div>
          )) : <div className="mt" style={{ marginTop: 6 }}>Nothing to claim yet. Prizes from finished rounds appear here.</div>}
        </div>
        {data && <div className="card"><b>My cards this round</b>
          {squads.filter((s) => s.owned).length ? squads.filter((s) => s.owned).map((s) => (
            <div className="mt" style={{ padding: "6px 0" }} key={String(s.id)}>{s.name} · {s.mints} cards {data.leaderId === s.id ? "· 👑 leading" : ""}</div>
          )) : <div className="mt">No cards yet.</div>}
        </div>}
      </>)}

      {tab === "rules" && <div dangerouslySetInnerHTML={{ __html: RULES_HTML }} />}

      <nav><div>{[["build", "⚽", "Build"], ["top", "🏆", "Top"], ["earn", "💰", "Wallet"], ["rules", "📘", "Rules"]].map((t) => (
        <button key={t[0]} className={tab === t[0] ? "on" : ""} onClick={() => setTab(t[0])}><span>{t[1]}</span>{t[2]}</button>
      ))}</div></nav>

      {msg && <div className="toast">{msg}</div>}

      {modal && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setModal(null)}><div>
          {modal.type === "pick" && (<>
            <b>Choose {POS[modal.i]}</b><p className="sub">Top 10</p>
            {PLAYERS.filter((p) => p.pos === POS[modal.i] && !slots.includes(p.id)).map((p) => (
              <div className="pl" key={p.id} onClick={() => setP(p.id)}><Shirt p={p} /><div className="grow nm">{p.n}</div><div className="mt">#{p.no}</div></div>
            ))}
            {slots[modal.i] !== null && <button className="btn alt" onClick={() => setP(null)}>Remove player</button>}
          </>)}
          {modal.type === "welcome" && (<>
            <h1>Welcome to Squad Cards ⚽</h1><p className="sub">Two ways to play. Each round lasts 3 days.</p>
            <div className="card"><b>1 · Build a squad</b><div className="mt" style={{ marginTop: 4, lineHeight: 1.5 }}>Pick 6 players, register for $0.10 and get card #1. Share your squad so people mint it. If it gets the most cards, you get your money back plus your share of the profit and a 20% creator bonus.</div></div>
            <div className="card"><b>2 · Back a squad</b><div className="mt" style={{ marginTop: 4, lineHeight: 1.5 }}>Open the Top tab and mint a card of any squad on the leaderboard. If that squad finishes first, you get your payment back plus a share of the profit.</div></div>
            <div className="card risk" style={{ fontSize: 12, lineHeight: 1.5 }}>Cards can't be sold. Only one squad wins each round, and if yours doesn't, you lose what you paid. Not financial advice.</div>
            <button className="btn" onClick={() => setModal(null)}>Start playing</button>
            <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); setTab("rules"); setModal(null); }}>Read the full rules &amp; risks</a>
          </>)}
          {modal.type === "consent" && (<>
            <h1>Before you play</h1><p className="sub">Please confirm you understand:</p>
            <div className="card risk" style={{ fontSize: 13, lineHeight: 1.5 }}>• You can lose everything you pay.<br />• Only one squad wins each round.<br />• Cards cannot be sold or transferred.<br />• Nothing is guaranteed and this is not financial advice.</div>
            <button className="btn" onClick={() => { safe(() => localStorage.setItem("ack", "1")); const f = modal.fn; setModal(null); f(); }}>I understand — continue</button>
            <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); setTab("rules"); setModal(null); }}>Read full rules</a>
          </>)}
          {(modal.type === "done" || modal.type === "minted") && (() => {
            const sq = modal.type === "done" ? mySquad : squads.find((x) => x.id === modal.id);
            if (!sq) return <p className="sub">Loading your squad…</p>;
            const rank = squads.findIndex((x) => x.id === sq.id) + 1;
            const text = shareText(modal.type === "done" ? "creator" : "minter", { name: sq.name, cards: sq.mints, rank, price: fm(sq.price), by: modal.by || "" }, modal.n || 0);
            return (<div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>🎉</div>
              <h1>{modal.type === "done" ? "Squad registered!" : "Card minted!"}</h1>
              <p className="sub">Share it and bring more people in.</p>
              <img src={`/api/og/${String(sq.id)}`} alt="" style={{ width: "100%", borderRadius: 12 }} />
              <div className="cast" style={{ textAlign: "left" }}>{text}</div>
              <button className="btn" onClick={() => doShare(text, sq.id)}>Share on Farcaster</button>
              <button className="btn alt" onClick={() => setModal({ ...modal, n: (modal.n || 0) + 1 })}>🔀 Another text</button>
              <a className="lnk" href="#" onClick={(e) => { e.preventDefault(); setModal(null); setTab("top"); }}>Maybe later</a>
            </div>);
          })()}
        </div></div>
      )}
    </div>
  );
}
