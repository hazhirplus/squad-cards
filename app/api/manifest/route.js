import { APP_URL } from "../../../lib/config";

export async function GET() {
  return Response.json({
    accountAssociation: {
      header: process.env.ACCOUNT_HEADER,
      payload: process.env.ACCOUNT_PAYLOAD,
      signature: process.env.ACCOUNT_SIGNATURE,
    },
    miniapp: {
      version: "1",
      name: "Squad Cards",
      homeUrl: APP_URL,
      iconUrl: `${APP_URL}/icon.png`,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: "#2b0030",
      subtitle: "Build a squad. Win the round.",
      description: "Build a 6-player football squad, collect cards and win the round on Base.",
      primaryCategory: "games",
      tags: ["football", "fantasy", "nft", "base"],
    },
  });
}
