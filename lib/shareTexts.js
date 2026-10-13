// Ready-made cast texts. {name} squad name, {cards} cards minted, {rank} leaderboard rank,
// {price} price of the NEXT card, {by} creator handle (may be empty).
const CREATOR = [
  "I just built “{name}” on Squad Cards ⚽ {cards} card(s) minted, {rankText}. Mint a card for {price} and let's win this round together 🏆",
  "New squad just dropped: “{name}” ⚽🔥 Cards cost {price} right now and the price goes up with every mint. Get in early and help me top the leaderboard!",
  "Think you know football? I locked in “{name}”. Back my squad for {price} — if we finish #1, holders get paid 💸",
  "{rankText} and climbing 📈 “{name}” needs more cards to win this round. Mint yours for {price} 👇",
  "Six players. One squad. “{name}” is ready to take the round 🏆 Join me — a card is only {price} right now.",
  "I built a squad, now I need a squad behind it 😄 Mint a card of “{name}” for {price} and let's climb the leaderboard together ⚽",
  "Card prices only go up from here 👀 Grab a “{name}” card at {price} before the next mint pushes it higher.",
  "The round is live and “{name}” is in the race ({cards} cards so far). Mint at {price} and help us win ⚽🟣",
  "My dream six is on-chain: “{name}” ⚽ Be one of the first holders — next card is {price}. Let's go for #1!",
  "Who's backing “{name}”? 🙋 {rankText}, next card is {price}. The bigger our squad, the better our shot at the pool 🏆",
];
const MINTER = [
  "Just minted a card of “{name}”{by} ⚽ It's {rankText} right now. Mint yours (next card {price}) and let's win this round together 🏆",
  "I'm backing “{name}”{by} 💪 {rankText}. The more of us mint, the better our chances!",
  "Picked my squad for this round: “{name}”{by}. {cards} cards and counting — the next one costs {price}. Join in 👇",
  "Backing a winner? We'll see 😎 I minted “{name}”{by}. {rankText} — help us climb!",
  "Squad Cards is heating up 🔥 I'm in on “{name}”{by} ({rankText}). Mint a card and let's take the pool together.",
  "Minted a card of “{name}”{by}. If this squad finishes first, holders get paid 🏆 Come join us before the price goes up (now {price})!",
  "Not building, just backing the right squad ⚽ “{name}”{by} — {rankText}. Mint yours for {price}.",
  "Another card for “{name}”{by} 🟣 {cards} cards now, next one is {price}. Let's push it to #1!",
  "I picked “{name}”{by} for this round 👀 {rankText}. Cards get pricier with every mint, so earlier is cheaper!",
  "Team up with me on “{name}”{by} ⚽ We're {rankText}. Mint a card ({price}) and let's win this together 🏆",
];

export function shareText(kind, v, n = 0) {
  const list = kind === "creator" ? CREATOR : MINTER;
  const rankText = v.rank === 1 ? "leading the leaderboard" : v.rank > 1 ? `ranked #${v.rank}` : "in the race";
  const by = v.by ? ` by @${v.by}` : "";
  return list[Math.abs(n) % list.length]
    .replaceAll("{name}", v.name).replaceAll("{cards}", String(v.cards)).replaceAll("{price}", v.price)
    .replaceAll("{rankText}", rankText).replaceAll("{by}", by);
}
