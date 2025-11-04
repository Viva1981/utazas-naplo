import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' vercel.live",
              "style-src 'self' 'unsafe-inline'",
              // ⬇️ ENGEDÉLYEZZÜK A GOOGLE/DRIVE KÉPEKET
              "img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com https://drive.google.com",
              "connect-src 'self' https://*.googleapis.com",
              "frame-src https://drive.google.com",
              "media-src 'self' data: blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // (nem kötelező, de jó ha később <Image>-et használsz)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "drive.google.com" },
    ],
  },
};

export default nextConfig;
