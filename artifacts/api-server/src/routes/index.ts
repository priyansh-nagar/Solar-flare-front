import { Router, type IRouter } from "express";
import healthRouter from "./health";
import replayRouter from "./replay";

const router: IRouter = Router();

router.use(healthRouter);
router.use(replayRouter);

export default router;
