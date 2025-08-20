import express from "express";
import formidable from "formidable";
import FormData from "form-data";
import fetch from "node-fetch";
import fs from "fs";

const router = express.Router();

router.post("/send-image", (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err: any, fields, files) => {
    if (err) return res.status(500).json({ error: "Form parsing error" });

    const chatId = fields.chatId as unknown as string;
    const file = files.file as any;

    if (!chatId || !file) return res.status(400).json({ error: "Missing chatId or file" });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ error: "Bot token missing" });

    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", "Here is your 1920x1080 heatmap!");
      formData.append("document", fs.createReadStream(file.filepath), file.originalFilename);

      const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: "POST",
        body: formData,
      });

      if (!telegramRes.ok) {
        const errorData = await telegramRes.json();
        return res.status(telegramRes.status).json(errorData);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to send image" });
    }
  });
});

export { router as TelegramRouter };