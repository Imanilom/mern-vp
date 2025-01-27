import express from "express";
import { createLog } from "../controllers/logs.controller.js";

const router = express.Router();

// Route untuk menyimpan log
router.post("/logs", createLog);

export default router;
