import { Router } from "express";
import {
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transaction.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listTransactions));
router.post("/", asyncHandler(createTransaction));
router.get("/:id", asyncHandler(getTransaction));
router.patch("/:id", asyncHandler(updateTransaction));
router.delete("/:id", asyncHandler(deleteTransaction));

export default router;
