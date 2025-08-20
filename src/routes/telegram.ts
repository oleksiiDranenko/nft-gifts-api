import express from "express";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";

const router = express.Router();
const upload = multer();

router.post("/send-image", upload.any(), async (req, res) => {
  try {
    // accept both camelCase and snake_case
    const chatId = req.body.chatId || req.body.chat_id;
    const files = req.files as Express.Multer.File[];
    const file = files?.[0]; 

    if (!chatId || !file) {
      return res.status(400).json({ message: "Missing data" });
    }

    const formData = new FormData();
    formData.append("chat_id", chatId);

    // add file
    formData.append("document", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // optionally add caption if provided
    if (req.body.caption) {
      formData.append("caption", req.body.caption);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;

    const response = await axios.post(telegramApiUrl, formData, {
      headers: formData.getHeaders(),
    });

    res.json({ success: true, data: response.data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export { router as TelegramRouter };
