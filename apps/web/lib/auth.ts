process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@cal-bot/db";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || !profile) return false;
      
      // Simpan/update user ke database
      if (account.provider === "discord") {
        try {
          await prisma.user.upsert({
            where: { discordId: (profile as any).id },
            update: {
              name: user.name,
              image: user.image,
            },
            create: {
              discordId: (profile as any).id,
              name: user.name,
              image: user.image,
            },
          });
        } catch (error) {
          console.error("Error saving user:", error);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Tambahkan discordId ke session untuk digunakan nanti
        (session.user as any).discordId = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
