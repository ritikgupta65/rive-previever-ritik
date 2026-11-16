import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Rive runtime owns WebGL contexts and wasm instances; StrictMode's
  // double-mount in dev would create and immediately destroy them.
  reactStrictMode: false,
};

export default nextConfig;
