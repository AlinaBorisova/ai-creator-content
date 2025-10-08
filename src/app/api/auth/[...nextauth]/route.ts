// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { DefaultSession, AuthOptions } from "next-auth";
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
        const allData = credentials as Record<string, string | number>;

        if (!allData || !allData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
          console.error("Authorize error: Missing data or bot token.");
          return null;
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const hash = allData.hash;

        // =================================================================
        // Создаем строку ТОЛЬКО из известных полей Telegram,
        // полностью игнорируя служебные поля от NextAuth.
        // =================================================================
        const telegramKeys = [
          'id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'
        ];

        const checkString = telegramKeys
          // Берем только те ключи из нашего списка, которые реально есть в данных
          .filter(key => allData[key] !== undefined && allData[key] !== null)
          // Создаем из них строки "ключ=значение"
          .map(key => `${key}=${allData[key]}`)
          // Сортируем и объединяем
          .sort()
          .join('\n');

        // Диагностика для сравнения
        console.log("--- CLEAN Data Check String ---");
        console.log(checkString);
        console.log("-------------------------------");

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

        // Теперь, когда проверка пройдена, мы можем безопасно работать с данными как с TelegramUser
        const userData = allData as unknown as TelegramUser;

        // Проверка на устаревание данных
        if (userData.auth_date) {
          const authDate = new Date(userData.auth_date * 1000);
          const now = new Date();
          if (now.getTime() - authDate.getTime() > 86400000) { // 24 часа
            console.error("Authorize error: Auth data is outdated.");
            return null;
          }
        }

        const telegramId = userData.id.toString();

        try {
          // Ищем или создаем пользователя
          const user = await prisma.user.upsert({
            where: { id: telegramId },
            update: {
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
            },
            create: {
              id: telegramId,
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
              email: null,
            },
          });
          console.log("SUCCESS! User authorized:", user.name);
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