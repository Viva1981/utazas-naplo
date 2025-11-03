import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { driveCreateFolder } from "@/lib/drive";
import { sheetsAppend, sheetsFindRowBy, sheetsUpdateRange } from "@/lib/sheets";

const USERS_SHEET = "Users!A2:F"; // fejléc A1:F1
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

// User + user-mappa "ensure" bejelentkezéskor
async function ensureUserAndFolder(accessToken: string, email: string, displayName: string) {
  console.log("ENSURE user start →", { email, displayName, ROOT_FOLDER_ID });

  const { index, row } = await sheetsFindRowBy(
    USERS_SHEET,
    (r) => (r[1] || "").toLowerCase() === email.toLowerCase()
  );

  if (index >= 0 && row) {
    // ha nincs folder id, hozzuk létre és frissítsük a sort
    if (!row[3]) {
      const folderName = displayName || email;
      const folder = await driveCreateFolder(accessToken, folderName, ROOT_FOLDER_ID);
      const targetRowA1 = `Users!A${2 + index}:F${2 + index}`;
      const updated = [
        row[0] || email,             // user_id
        row[1] || email,             // email
        row[2] || displayName || "", // display_name
        folder.id,                   // drive_user_folder_id
        folder.webViewLink || "",    // drive_user_folder_link
        row[5] || "user",            // role
      ];
      await sheetsUpdateRange(targetRowA1, [updated]);
      return { userId: updated[0], folderId: folder.id };
    }
    return { userId: row[0] || email, folderId: row[3] };
  }

  // új user → létrehozzuk a mappát és felvesszük a Users lapra
  const folderName = displayName || email;
  const folder = await driveCreateFolder(accessToken, folderName, ROOT_FOLDER_ID);
  const userId = email;

  await sheetsAppend("Users!A1", [
    userId,
    email,
    displayName || "",
    folder.id,
    folder.webViewLink || "",
    "user",
  ]);

  return { userId, folderId: folder.id };
}

// <<< CSAK EGY export legyen ebből! >>>
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/spreadsheets",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        (token as any).accessToken = account.access_token;
        (token as any).refreshToken = account.refresh_token;

        try {
          const email = (profile as any)?.email || "";
          const name  = (profile as any)?.name  || "";
          console.log("🔍 ensureUserAndFolder called", { email, name });

          if (email && (token as any).accessToken) {
            const ensured = await ensureUserAndFolder((token as any).accessToken as string, email, name);
            (token as any).userId       = ensured.userId;
            (token as any).userFolderId = ensured.folderId;
          }
        } catch (e) {
          console.error("ensureUserAndFolder error:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken  = (token as any).accessToken;
      (session as any).userId       = (token as any).userId;
      (session as any).userFolderId = (token as any).userFolderId;
      return session;
    },
  },
};
