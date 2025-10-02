/** @type {import('next').NextConfig} */
const nextConfig = {
  // Добавляем эту секцию для настройки изображений
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
};

module.exports = nextConfig;
