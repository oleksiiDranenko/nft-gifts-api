import express from "express";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";
import sharp from "sharp";
import stream from "stream";

const router = express.Router();

// Memory storage (only for incoming upload)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/send-image", upload.single("file"), async (req, res) => {
  try {
    const chatId = req.body.chatId || req.body.chat_id;
    const file = req.file;

    if (!chatId || !file) {
      return res.status(400).json({ message: "Missing data" });
    }

    // 1️⃣ Create a PassThrough stream for optimized output
    const optimizedStream = new stream.PassThrough();

    // 2️⃣ Pipe file buffer through sharp (resize + compress) into the PassThrough stream
    sharp(file.buffer)
      .jpeg({ quality: 70 }) // compress
      .resize({ width: 1080, withoutEnlargement: true }) // optional max width
      .pipe(optimizedStream);

    // 3️⃣ Prepare form-data with the streaming document
    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", optimizedStream, {
      filename: file.originalname.replace(/\.[^/.]+$/, ".jpg"),
      contentType: "image/jpeg",
    });

    if (req.body.caption) {
      formData.append("caption", req.body.caption);
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;

    // 4️⃣ Send to Telegram
    const response = await axios.post(telegramApiUrl, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity, // for large files
    });

    res.json({ success: true, data: response.data });
  } catch (err: any) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export { router as TelegramRouter };
