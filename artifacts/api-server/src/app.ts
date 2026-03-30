import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import passport from "./lib/google-auth";
import { getFrontendBase } from "./lib/google-auth";

const SESSION_SECRET_FALLBACK = "finance-app-secret-key-dev";

const app: Express = express();

// Trust the first proxy hop — required for secure cookies behind Replit's reverse proxy
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
// contentSecurityPolicy is disabled because this is a JSON API server (no HTML).
// All other Helmet defaults are kept: X-Frame-Options, X-Content-Type-Options,
// HSTS, Referrer-Policy, X-DNS-Prefetch-Control, etc.
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Derive the allowed origin from FRONTEND_URL (or fall back to the Replit dev
// domain / localhost for local development).  We extract just the scheme+host
// part of the URL so the path prefix does not accidentally mismatch.
function getAllowedOrigin(): string | string[] {
  const frontendBase = getFrontendBase();
  try {
    const { origin } = new URL(frontendBase);
    return origin;
  } catch {
    return frontendBase;
  }
}

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      const allowed = getAllowedOrigin();
      // Allow requests with no Origin (same-origin / server-to-server)
      if (!requestOrigin) return callback(null, true);
      const allowedList = Array.isArray(allowed) ? allowed : [allowed];
      if (allowedList.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Sessions ──────────────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

const isProduction = process.env["NODE_ENV"] === "production";

const sessionSecret = process.env["SESSION_SECRET"] ?? SESSION_SECRET_FALLBACK;
if (sessionSecret === SESSION_SECRET_FALLBACK) {
  logger.warn(
    "SESSION_SECRET is using the development fallback. Set SESSION_SECRET in production."
  );
}

app.use(
  session({
    store: new PgSession({
      pool,                          // reuse the existing connection pool
      tableName: "user_sessions",    // table created on first deploy via seed
      pruneSessionInterval: 60 * 15, // clean up expired sessions every 15 min
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,    // HTTPS-only in production
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Initialize passport (no persistent sessions — we manage sessions via express-session)
app.use(passport.initialize());

app.use("/api", router);

export default app;
