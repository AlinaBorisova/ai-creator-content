import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from "./providers"
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Content Generator',
  description: 'Создано с помощью Next.js и YandexGPT',
}

export default function RootLayout({children}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className='bg-gray-900 text-white p-4'>
    <body className={inter.className}>
    <Providers>
      {children}
    </Providers>
    </body>
    </html>
  );
}
