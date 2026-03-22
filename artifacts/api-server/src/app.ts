import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import passport from "./lib/google-auth";

const app: Express = express();

// Trust the first proxy hop — required for secure cookies behind Replit's reverse proxy
app.set("trust proxy", 1);

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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);

const isProduction = process.env["NODE_ENV"] === "production";

app.use(
  session({
    store: new PgSession({
      pool,                          // reuse the existing connection pool
      tableName: "user_sessions",    // table created on first deploy via seed
      pruneSessionInterval: 60 * 15, // clean up expired sessions every 15 min
    }),
    secret: process.env["SESSION_SECRET"] ?? "finance-app-secret-key-dev",
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
