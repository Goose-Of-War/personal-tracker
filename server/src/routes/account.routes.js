import { Router } from "express";
import {
  listAccounts,
  createAccount,
  getAccount,
  updateAccount,
  archiveAccount,
} from "../controllers/account.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listAccounts));
router.post("/", asyncHandler(createAccount));
router.get("/:id", asyncHandler(getAccount));
router.patch("/:id", asyncHandler(updateAccount));
router.delete("/:id", asyncHandler(archiveAccount));

export default router;
