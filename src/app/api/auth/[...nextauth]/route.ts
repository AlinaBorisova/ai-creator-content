// src/app/api/auth/[...nextauth]/route.ts (ФИНАЛЬНАЯ ВЕРСИЯ)
import NextAuth, { DefaultSession, AuthOptions } from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { JWT } from "next-auth/jwt";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from '@/lib/prisma';
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "telegram-widget",
      name: "Telegram Widget",
      credentials: {},

      async authorize(credentials) {
        const userData = credentials as Partial<TelegramUser>; // Используем Partial для большей безопасности

        if (!userData || !userData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
          console.error("Authorize error: Missing user data or bot token.");
          return null;
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const { hash, ...dataToCheck } = userData;

        // =================================================================
        // Фильтруем ключи, чтобы исключить
        // любые поля со значением `undefined`, идеально повторяя логику Telegram.
        // =================================================================
        const checkString = Object.keys(dataToCheck)
          .filter((key) => dataToCheck[key as keyof typeof dataToCheck] !== undefined) // <-- ВОТ ОНО, РЕШЕНИЕ
          .sort()
          .map((key) => (`${key}=${dataToCheck[key as keyof typeof dataToCheck]}`))
          .join('\n');

        // Диагностика для сравнения
        console.log("--- Data Check String ---");
        console.log(checkString);
        console.log("-------------------------");

        const secretKey = crypto.createHash('sha256')
          .update(botToken)
          .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
          .update(checkString)
          .digest('hex');

        if (hmac !== hash) {
          console.error("Authorize error: Invalid hash. Data might be forged.");
          console.log(`Expected hash: ${hmac}`);
          console.log(`Received hash: ${hash}`);
          return null;
        }

        // Проверка на устаревание данных
        if (userData.auth_date) {
          const authDate = new Date(userData.auth_date * 1000);
          const now = new Date();
          if (now.getTime() - authDate.getTime() > 86400000) { // 24 часа
            console.error("Authorize error: Auth data is outdated.");
            return null;
          }
        }

        const telegramId = userData.id!.toString();

        try {
          // Ищем или создаем пользователя
          const user = await prisma.user.upsert({
            where: { id: telegramId },
            update: { // Обновляем данные, если пользователь уже существует
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
            },
            create: { // Создаем, если его нет
              id: telegramId,
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
              email: null, // email не предоставляется
            },
          });
          return user;

        } catch (error) {
          console.error("Error during DB operation in authorize:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };