import { Router } from "express";
import { getHomeStats } from "../controllers/home.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/expense-stats", asyncHandler(getHomeStats));

export default router;
