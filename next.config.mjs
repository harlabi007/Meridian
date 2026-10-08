   /** @type {import('next').NextConfig} */
   const nextConfig = {
     reactStrictMode: true,
     typescript: { ignoreBuildErrors: true },
     eslint: { ignoreDuringBuilds: true },
     webpack: (config) => {
       // Solana web3 libs expect these Node core modules to be resolvable in the browser bundle
       config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false };
       return config;
     },
   };

   export default nextConfig;