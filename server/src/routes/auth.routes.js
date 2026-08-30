import { Router } from "express";
import { signup, login, logout, me, updateCategories, updateCurrency } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/categories", requireAuth, asyncHandler(updateCategories));
router.patch("/currency", requireAuth, asyncHandler(updateCurrency));

export default router;
