import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import alertsRouter from "./alerts";
import patternsRouter from "./patterns";
import bugscanRouter from "./bugscan";
import rileyChatRouter from "./riley-chat";
import reconRouter from "./recon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(alertsRouter);
router.use(patternsRouter);
router.use(bugscanRouter);
router.use(rileyChatRouter);
router.use(reconRouter);

export default router;
