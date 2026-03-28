import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import subcategoriesRouter from "./subcategories";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import projectsRouter from "./projects";
import settingsRouter from "./settings";
import peopleRouter from "./people";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(subcategoriesRouter);
router.use(transactionsRouter);
router.use(budgetsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(projectsRouter);
router.use(settingsRouter);
router.use(peopleRouter);
router.use(aiRouter);

export default router;
