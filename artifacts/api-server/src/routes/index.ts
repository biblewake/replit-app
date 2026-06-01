import { Router, type IRouter } from "express";
import healthRouter from "./health";
import versesRouter from "./verses";
import deepgramRouter from "./deepgram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(versesRouter);
router.use(deepgramRouter);

export default router;
