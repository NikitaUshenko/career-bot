import path from "node:path";
import { loadDotEnv } from "./env.js";
import { fetchJson } from "./utils.js";

loadDotEnv(path.resolve(".env"));

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Set TELEGRAM_BOT_TOKEN in .env first");

const payload = await fetchJson(`https://api.telegram.org/bot${token}/getUpdates`);
const chats = new Map();

for (const update of payload?.result ?? []) {
  const chat = update.message?.chat ?? update.channel_post?.chat ?? update.edited_message?.chat;
  if (chat) chats.set(String(chat.id), chat);
}

if (chats.size === 0) {
  console.log("No chats found. Open the bot in Telegram, send /start, then run this command again.");
} else {
  for (const [id, chat] of chats) {
    console.log(`${id}\t${chat.type}\t${chat.username ?? chat.title ?? chat.first_name ?? ""}`);
  }
}
