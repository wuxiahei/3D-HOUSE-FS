/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@fengshui/core", "@fengshui/simulation"],
  experimental: {
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true
  }
};

export default nextConfig;
