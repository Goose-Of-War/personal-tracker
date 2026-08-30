import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getDashboard));

export default router;
