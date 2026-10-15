

import express from "express";

import {
    getAllBotEvents,
    getBotEvents,
    getBotEventById,
    createBotEvent,
    deleteBotEvent,
} from "../controllers/botEventController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication.
router.use(protect);

// GET /api/bot-events
router.get("/", getAllBotEvents);

// GET /api/bot-events/bot/1
router.get("/bot/:id", getBotEvents);

// GET /api/bot-events/event/1
router.get("/event/:eventId", getBotEventById);

// POST /api/bot-events
router.post("/", createBotEvent);

// DELETE /api/bot-events/event/1
router.delete("/event/:eventId", deleteBotEvent);

export default router;

