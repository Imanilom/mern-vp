import express from "express";
import { createLog } from "../controllers/logs.controller.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });
// Route untuk menyimpan log
router.post("/logs", upload.single("file"), createLog);

export default router;
