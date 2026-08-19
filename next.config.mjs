/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.feishu.cn" },
      { protocol: "https", hostname: "**.larksuite.com" },
    ],
  },
  // Cloudflare Pages 需要
  experimental: {
    serverMinification: false,
  },
};

export default nextConfig;
