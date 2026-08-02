import path from "node:path";
import { loadDotEnv } from "./env.js";
import { sendTelegramMessage } from "./telegram.js";

loadDotEnv(path.resolve(".env"));

await sendTelegramMessage({
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  text: "<b>Career Watch is connected</b>\nTelegram notifications are working.",
});

console.log("Test message sent.");
