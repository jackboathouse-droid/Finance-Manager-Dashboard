import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedUserCategories } from "../seed";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"] ?? "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const REPLIT_DEV_DOMAIN = process.env["REPLIT_DEV_DOMAIN"] ?? "";

export const googleOAuthEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

// The callback URL must exactly match what's registered in the Google Cloud Console.
// For deployed apps, GOOGLE_CALLBACK_URL overrides the default.
export function getCallbackURL(): string {
  return (
    process.env["GOOGLE_CALLBACK_URL"] ??
    `https://${REPLIT_DEV_DOMAIN}/api/auth/google/callback`
  );
}

export function getFrontendBase(): string {
  return (
    process.env["FRONTEND_URL"] ??
    `https://${REPLIT_DEV_DOMAIN}/finance-app`
  );
}

if (googleOAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: getCallbackURL(),
        // Pass the request to the verify callback so we can access req.log
        passReqToCallback: false,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("Google account has no email address."));
          }

          const googleId = profile.id;
          const displayName = profile.displayName ?? email.split("@")[0];
          const pictureUrl = profile.photos?.[0]?.value ?? null;

          // 1. Look up by google_id (fastest path for returning Google users)
          let [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.google_id, googleId));

          if (user) {
            // Update picture in case it changed
            if (pictureUrl && pictureUrl !== user.profile_picture_url) {
              const [updated] = await db
                .update(usersTable)
                .set({ profile_picture_url: pictureUrl })
                .where(eq(usersTable.id, user.id))
                .returning();
              user = updated;
            }
            return done(null, user);
          }

          // 2. Look up by email (may be an existing email/password account)
          const [existingByEmail] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email.toLowerCase()));

          if (existingByEmail) {
            // Link Google to the existing account
            const [linked] = await db
              .update(usersTable)
              .set({
                google_id: googleId,
                profile_picture_url: pictureUrl ?? existingByEmail.profile_picture_url,
              })
              .where(eq(usersTable.id, existingByEmail.id))
              .returning();
            return done(null, linked);
          }

          // 3. Brand new user — create account
          const [newUser] = await db
            .insert(usersTable)
            .values({
              full_name: displayName,
              email: email.toLowerCase(),
              password_hash: null,
              auth_provider: "google",
              google_id: googleId,
              profile_picture_url: pictureUrl,
            })
            .returning();

          // Seed default categories for new Google user (awaited — user should have categories on first login)
          try {
            await seedUserCategories(newUser.id);
          } catch {
            // Non-fatal: log but don't block OAuth flow
          }

          return done(null, newUser);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// We manage sessions ourselves — minimal passport serialization
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: number, done) => done(null, { id } as any));

export default passport;
