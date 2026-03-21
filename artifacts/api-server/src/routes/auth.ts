import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "admin";

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
    (req.session as any).authenticated = true;
    (req.session as any).username = username;
    res.json({ success: true, username });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", (req, res) => {
  if ((req.session as any)?.authenticated) {
    res.json({ username: (req.session as any).username, authenticated: true });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;
