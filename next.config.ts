import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_DEPLOY_ID: process.env.VERCEL_DEPLOYMENT_ID || 'local',
  },
};

export default nextConfig;
