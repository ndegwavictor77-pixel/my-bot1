import express from "express";

import {
  createTrade,
  getAllTrades,
  getTradeById,
  updateTrade,
  closeTrade,
  deleteTrade,
} from "../controllers/tradeController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All trade endpoints require authentication.
router.use(protect);

// Create a trade
router.post("/", createTrade);

// Get all trades belonging to the authenticated user
router.get("/", getAllTrades);

// Get one trade
router.get("/:id", getTradeById);

// Update trade risk settings
router.patch("/:id", updateTrade);

// Close a trade
router.patch("/:id/close", closeTrade);

// Delete a trade
router.delete("/:id", deleteTrade);

export default router;