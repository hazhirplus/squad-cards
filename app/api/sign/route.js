import { createClient } from "@farcaster/quick-auth";
import { keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, CONTRACT, APP_URL } from "../../../lib/config";

const client = createClient();

// Proves the caller really owns the Farcaster account (Quick Auth), then signs
// (chain, contract, wallet, fid, deadline). The contract checks this signature.
export async function POST(req) {
  try {
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { address } = await req.json();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address || "")) return Response.json({ error: "bad address" }, { status: 400 });
    const payload = await client.verifyJwt({ token, domain: new URL(APP_URL).host });
    const fid = BigInt(payload.sub);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const hash = keccak256(
      encodePacked(["uint256", "address", "address", "uint256", "uint256"], [BigInt(CHAIN.id), CONTRACT, address, fid, deadline])
    );
    let pk = process.env.SIGNER_PRIVATE_KEY || "";
    if (!pk.startsWith("0x")) pk = "0x" + pk;
    const signature = await privateKeyToAccount(pk).signMessage({ message: { raw: hash } });
    return Response.json({ fid: fid.toString(), deadline: deadline.toString(), signature });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 401 });
  }
}
