import { APP_URL } from "../../../lib/config";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const embed = {
    version: "1",
    imageUrl: `${APP_URL}/api/og/${id}`,
    button: { title: "Mint this squad", action: { type: "launch_miniapp", name: "Squad Cards", url: `${APP_URL}?squad=${id}` } },
  };
  return { title: "Squad Cards", other: { "fc:miniapp": JSON.stringify(embed) } };
}

export default async function Share({ params }) {
  const { id } = await params;
  return (
    <div id="app">
      <img src={`/api/og/${id}`} alt="Squad" style={{ width: "100%", borderRadius: 16 }} />
      <a className="lnk" href={APP_URL}>Play Squad Cards</a>
    </div>
  );
}
