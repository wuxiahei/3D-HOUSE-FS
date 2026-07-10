import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@fengshui/core", "@fengshui/simulation"],
  experimental: {
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true
  }
};

export default nextConfig;
