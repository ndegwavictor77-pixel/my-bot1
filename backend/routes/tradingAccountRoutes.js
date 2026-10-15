
import express from "express";

import {
    createTradingAccount,
    getTradingAccounts,
    getTradingAccountById,
    updateTradingAccount,
    disconnectTradingAccount,
    deleteTradingAccount,
} from "../controllers/tradingAccountController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication.
router.use(protect);

// Register an account.
router.post("/", createTradingAccount);

// Get all accounts belonging to the logged-in user.
router.get("/", getTradingAccounts);

// Get one account.
router.get("/:id", getTradingAccountById);

// Update account details.
router.patch("/:id", updateTradingAccount);

// Mark an account inactive.
router.patch("/:id/disconnect", disconnectTradingAccount);

// Delete an account.
router.delete("/:id", deleteTradingAccount);

export default router;

