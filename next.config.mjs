/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.feishu.cn" },
      { protocol: "https", hostname: "**.larksuite.com" },
    ],
  },
};

export default nextConfig;
