/** @type {import('next').NextConfig} */
const nextConfig = {
  // Добавляем эту секцию для настройки изображений
  async headers() {
    return [
      {
        source: '/:path*', // Применять ко всем страницам приложения
        headers: [
          {
            key: 'Content-Security-Policy',
            // Мы заменяем стандартную политику Next.js на нашу
            // frame-ancestors 'self' - разрешает встраивать контент с нашего же домена
            // https://oauth.telegram.org - ЯВНО разрешает встраивать фреймы от Telegram
            value: "frame-ancestors 'self' https://oauth.telegram.org;",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.mds.yandex.net', // Хост из вашей ошибки
        port: '',
        pathname: '/**', // Разрешаем любые пути на этом хосте
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com', // Старый хост, добавляем на всякий случай
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
