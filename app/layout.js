import "./globals.css";
import Providers from "./providers";
import { APP_URL } from "../lib/config";

const embed = {
  version: "1",
  imageUrl: `${APP_URL}/og.png`,
  button: { title: "Play Squad Cards", action: { type: "launch_miniapp", name: "Squad Cards", url: APP_URL } },
};
export const metadata = {
  title: "Squad Cards",
  description: "Build a football squad, collect cards, win the round.",
  other: { "fc:miniapp": JSON.stringify(embed) },
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
