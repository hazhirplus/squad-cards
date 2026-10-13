/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/.well-known/farcaster.json", destination: "/api/manifest" }];
  },
};
