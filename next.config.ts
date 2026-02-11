import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
        port: "",
        pathname: "/**",
      },
      // Add your custom domain if you have one
      // {
      //   protocol: 'https',
      //   hostname: 'your-custom-domain.com',
      //   port: '',
      //   pathname: '/**',
      // },
    ],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
