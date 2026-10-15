
import express from "express";

import {
    createBotInstance,
    getBotInstances,
    getBotInstanceById,
    updateBotInstance,
    startBotInstance,
    stopBotInstance,
    pauseBotInstance,
    resumeBotInstance,
    deleteBotInstance,
} from "../controllers/botInstanceController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Every route requires authentication.
router.use(protect);

router.post("/", createBotInstance);
router.get("/", getBotInstances);
router.get("/:id", getBotInstanceById);
router.patch("/:id", updateBotInstance);

router.post("/:id/start", startBotInstance);
router.post("/:id/stop", stopBotInstance);
router.post("/:id/pause", pauseBotInstance);
router.post("/:id/resume", resumeBotInstance);

router.delete("/:id", deleteBotInstance);

export default router;
