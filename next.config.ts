import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Разрешаем доступ к картинкам из бакетов Supabase Storage для оптимизатора изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Разрешаем безопасный доступ к dev-серверу с iPhone и других устройств в локальной сети Wi-Fi
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.100.4',
    '192.168.100.*',
    '192.168.1.*',
    '192.168.0.*',
  ],
};

export default nextConfig;
