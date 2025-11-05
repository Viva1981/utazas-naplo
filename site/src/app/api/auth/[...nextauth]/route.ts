import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Next 16 + App Router biztonsági flag-ek
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret:
        (process.env.GOOGLE_CLIENT_SECRET as string) ||
        (process.env.Google_CLIENT_SECRET as string),
      // minimál auth, extra scope NÉLKÜL – most az a cél, hogy a login oldal MEGJÖJJÖN
    }),
  ],
});

export { handler as GET, handler as POST };
