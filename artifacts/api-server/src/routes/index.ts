import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import alertsRouter from "./alerts";
import patternsRouter from "./patterns";
import bugscanRouter from "./bugscan";
import rileyChatRouter from "./riley-chat";
import reconRouter from "./recon";
import threatMapRouter from "./threat-map";
import tier1AgentRouter from "./tier1-agent";
import investigateRouter from "./investigate";
import osintRouter from "./osint";
import waitlistRouter from "./waitlist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(alertsRouter);
router.use(patternsRouter);
router.use(bugscanRouter);
router.use(rileyChatRouter);
router.use(reconRouter);
router.use(threatMapRouter);
router.use(tier1AgentRouter);
router.use(investigateRouter);
router.use(osintRouter);
router.use(waitlistRouter);

export default router;
