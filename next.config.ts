/**
 * Next.js config — enables the instrumentation hook so `instrumentation.ts`
 * runs at startup (PostHog Logs setup, per their "Integrate with Next.js" guide).
 *
 * ⚠️ This repository is built with Vite (see `vite.config.ts`) and does NOT run
 * Next.js — this file is inert here and exists only to mirror PostHog's
 * documented Next.js setup alongside `instrumentation.ts`.
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
