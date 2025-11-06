import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { driveCreateFolder } from "@/lib/drive";
import { sheetsAppend, sheetsFindRowBy, sheetsUpdateRange } from "@/lib/sheets";

/**
 * Users sheet tartomány (A1 sor a fejléc).
 */
const USERS_SHEET = "Users!A2:F";

/**
 * Drive root mappa ID – több névvel is próbálkozunk,
 * mert a környezetben eltérhet (pl. DRIVE_UPLOAD_FOLDER_ID).
 */
const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
  process.env.DRIVE_UPLOAD_FOLDER_ID || // screenshotod alapján ez biztosan létezik
  "";

/**
 * Bejelentkezéskor: felhasználó és user-mappa létrehozása/ellenőrzése.
 * - Ha nincs ROOT_FOLDER_ID beállítva, a mappa-lépést kihagyjuk, de a user-t ettől még rögzítjük a sheetben.
 */
async function ensureUserAndFolder(
  accessToken: string,
  email: string,
  displayName: string
) {
  console.log("ENSURE user start →", { email, displayName, ROOT_FOLDER_ID: !!ROOT_FOLDER_ID });

  const { index, row } = await sheetsFindRowBy(
    USERS_SHEET,
    (r) => (r[1] || "").toLowerCase() === email.toLowerCase()
  );

  // helper a mappa létrehozására (csak ha van root ID)
  const createFolderIfPossible = async () => {
    if (!ROOT_FOLDER_ID) return { id: "", webViewLink: "" };
    try {
      const folderName = displayName || email;
      const folder = await driveCreateFolder(accessToken, folderName, ROOT_FOLDER_ID);
      return { id: folder.id, webViewLink: folder.webViewLink || "" };
    } catch (e) {
      console.error("driveCreateFolder error:", e);
      return { id: "", webViewLink: "" };
    }
  };

  if (index >= 0 && row) {
    // már létező user – ha nincs folder id és van root, akkor pótoljuk
    if (!row[3] && ROOT_FOLDER_ID) {
      const folder = await createFolderIfPossible();
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
    return { userId: row[0] || email, folderId: row[3] || "" };
  }

  // új user → mappa (ha lehet) + sormegnyitás
  const folder = await createFolderIfPossible();
  const userId = email;

  await sheetsAppend("Users!A1", [
    userId,                    // A: user_id
    email,                     // B: email
    displayName || "",         // C: display_name
    folder.id,                 // D: drive_user_folder_id
    folder.webViewLink || "",  // E: drive_user_folder_link
    "user",                    // F: role
  ]);

  return { userId, folderId: folder.id };
}

/**
 * <<< CSAK EZ az export legyen elérhető más modulokból >>>
 * NextAuth v4 kompatibilis beállítások, App Routerrel használva.
 */
export const authOptions: NextAuthOptions = {
  trustHost: true,                         // ⬅️ Vercel/Proxy mögötti host elfogadása
  secret: process.env.NEXTAUTH_SECRET,     // fontos v4-ben is
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret:
        (process.env.GOOGLE_CLIENT_SECRET as string) ||
        (process.env.Google_CLIENT_SECRET as string), // fallback elgépelés esetére
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
    // token gazdagítása, plusz felhasználó + mappa biztosítása
    async jwt({ token, account, profile }) {
      try {
        if (account) {
          (token as any).accessToken = account.access_token;
          (token as any).refreshToken = account.refresh_token;

          const email = (profile as any)?.email || "";
          const name  = (profile as any)?.name  || "";

          console.log("🔍 ensureUserAndFolder called", { email, name });

          if (email && (token as any).accessToken) {
            const ensured = await ensureUserAndFolder(
              String((token as any).accessToken),
              email,
              name
            );
            (token as any).userId       = ensured.userId;
            (token as any).userFolderId = ensured.folderId;
          }
        }
      } catch (e) {
        console.error("ensureUserAndFolder error:", e);
      }
      return token;
    },

    // session-be tükrözzük a JWT-ből a custom adatokat
    async session({ session, token }) {
      (session as any).accessToken  = (token as any).accessToken || "";
      (session as any).userId       = (token as any).userId || "";
      (session as any).userFolderId = (token as any).userFolderId || "";
      return session;
    },
  },
};
