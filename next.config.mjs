/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.feishu.cn" },
      { protocol: "https", hostname: "**.larksuite.com" },
    ],
  },
};

export default nextConfig;
