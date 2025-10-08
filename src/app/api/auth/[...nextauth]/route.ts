// src/app/api/auth/[...nextauth]/route.ts
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
        const userData = credentials as TelegramUser;

        if (!userData || !userData.hash || !process.env.TELEGRAM_BOT_TOKEN) {
          console.error("Authorize error: Missing user data or bot token.");
          return null;
        }

        const { hash, ...dataToCheck } = userData;

        // =================================================================
        // ИСПРАВЛЕННАЯ И ТИПОБЕЗОПАСНАЯ ВЕРСИЯ ПРОВЕРКИ
        // =================================================================
        const checkString = (Object.keys(dataToCheck) as Array<keyof typeof dataToCheck>)
          .sort()
          .map(key => (`${key}=${dataToCheck[key]}`))
          .join('\n');

        const secretKey = crypto.createHash('sha256')
          .update(process.env.TELEGRAM_BOT_TOKEN)
          .digest();

        const hmac = crypto.createHmac('sha256', secretKey)
          .update(checkString)
          .digest('hex');

        if (hmac !== hash) {
          console.error("Authorize error: Invalid hash. Data might be forged.");
          return null;
        }

        const authDate = new Date(userData.auth_date * 1000);
        const now = new Date();
        if (now.getTime() - authDate.getTime() > 86400000) {
          console.error("Authorize error: Auth data is outdated.");
          return null;
        }

        const telegramId = userData.id.toString();

        try {
          const user = await prisma.user.findUnique({
            where: { id: telegramId },
          });

          if (user) {
            return user;
          }

          const newUser = await prisma.user.create({
            data: {
              id: telegramId,
              name: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
              image: userData.photo_url,
              email: null,
            },
          });
          return newUser;

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

