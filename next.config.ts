import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Phone testing: `npm run dev` listens on the whole network, but Next's dev server refuses to serve its JavaScript to any
// address that is not localhost, so a phone opening http://<your-mac>:3000 gets the page but no taps work. Allow this
// machine's own network addresses. Only used by `next dev`; builds and the live site ignore it.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n): n is NonNullable<typeof n> => !!n && n.family === "IPv4" && !n.internal)
  .map((n) => n.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
