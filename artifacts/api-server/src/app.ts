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
// This is a JSON API server; configure Helmet with a strict CSP that blocks
// everything by default (no scripts, styles, or embeds expected from API responses).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    // X-Frame-Options is superseded by CSP frameAncestors above but keep both
    // for older browser compatibility
    frameguard: { action: "deny" },
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
// Build the list of allowed origins from FRONTEND_URL env var, the Replit dev
// domain, and (in development) common localhost ports.
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  const frontendBase = getFrontendBase();
  try {
    origins.push(new URL(frontendBase).origin);
  } catch {
    origins.push(frontendBase);
  }

  const isProduction = process.env["NODE_ENV"] === "production";
  if (!isProduction) {
    // Allow local development on common Vite/React ports
    origins.push(
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:8080",
    );
  }

  return [...new Set(origins)]; // deduplicate
}

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      const allowed = getAllowedOrigins();
      // Allow requests with no Origin header (same-origin / server-to-server)
      if (!requestOrigin) return callback(null, true);
      if (allowed.includes(requestOrigin)) {
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
