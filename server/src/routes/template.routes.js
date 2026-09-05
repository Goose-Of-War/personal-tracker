import { Router } from "express";
import { listTemplates, createTemplate, deleteTemplate } from "../controllers/template.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listTemplates));
router.post("/", asyncHandler(createTemplate));
router.delete("/:id", asyncHandler(deleteTemplate));

export default router;