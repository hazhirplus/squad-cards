const RAW={GK:"Neuer-1,Courtois-1,Alisson-1,Buffon-1,Casillas-1,Ederson-31,Oblak-13,ter Stegen-1,Donnarumma-99,E. Martínez-23",
DEF:"Ramos-4,Van Dijk-4,Maldini-3,Lahm-21,Dani Alves-2,Marcelo-12,Alexander-Arnold-66,Rúben Dias-3,Hakimi-2,Davies-19",
MID:"Modrić-10,De Bruyne-17,Xavi-6,Iniesta-8,Pirlo-21,Kroos-8,Rodri-16,Bellingham-5,Zidane-5,Pedri-8",
FWD:"Messi-10,C. Ronaldo-7,Mbappé-10,Haaland-9,Lewandowski-9,Neymar-10,Salah-11,Ronaldo (R9)-9,Henry-14,Ibrahimović-10"};
export const PLAYERS = [];
for (const pos of ["GK","DEF","MID","FWD"]) RAW[pos].split(",").forEach((s) => {
  const i = s.lastIndexOf("-");
  PLAYERS.push({ id: PLAYERS.length, n: s.slice(0, i), no: s.slice(i + 1), pos });
});
// ids: GK 0-9, DEF 10-19, MID 20-29, FWD 30-39 (the contract relies on this order)
