const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY || "mera-secret-key-123";

function auth(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (key !== API_KEY) {
    return res.status(401).json({ success: false, error: "Invalid API key" });
  }
  next();
}

app.get("/", (req, res) => {
  res.json({ status: "Notification Bridge chal raha hai!", version: "1.0" });
});

// 1. WEBHOOK
app.post("/send/webhook", auth, async (req, res) => {
  const { url, method = "POST", headers = {}, data } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "URL chahiye" });
  try {
    const response = await axios({ method, url, headers: { "Content-Type": "application/json", ...headers }, data });
    res.json({ success: true, status: response.status, response: response.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. EMAIL
app.post("/send/email", auth, async (req, res) => {
  const nodemailer = require("nodemailer");
  const { to, subject, message } = req.body;
  if (!to || !subject || !message)
    return res.status(400).json({ success: false, error: "to, subject, message chahiye" });
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER, to, subject,
      text: message, html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
    });
    res.json({ success: true, message: `Email bheja gaya: ${to}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. TELEGRAM
app.post("/send/telegram", auth, async (req, res) => {
  const { chat_id, message } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chat_id || !message)
    return res.status(400).json({ success: false, error: "chat_id aur message chahiye" });
  if (!token)
    return res.status(500).json({ success: false, error: "TELEGRAM_BOT_TOKEN set nahi hai" });
  try {
    const r = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id, text: message, parse_mode: "Markdown",
    });
    res.json({ success: true, telegram_response: r.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. WHATSAPP
app.post("/send/whatsapp", auth, async (req, res) => {
  const twilio = require("twilio");
  const { to, message } = req.body;
  if (!to || !message)
    return res.status(400).json({ success: false, error: "to aur message chahiye" });
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  try {
    const msg = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
      to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
      body: message,
    });
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. PUSH NOTIFICATION (Firebase FCM)
app.post("/send/push", auth, async (req, res) => {
  const { token, title, body, data = {} } = req.body;
  const fcmKey = process.env.FIREBASE_SERVER_KEY;
  if (!token || !title || !body)
    return res.status(400).json({ success: false, error: "token, title, body chahiye" });
  try {
    const r = await axios.post(
      "https://fcm.googleapis.com/fcm/send",
      { to: token, notification: { title, body }, data },
      { headers: { Authorization: `key=${fcmKey}`, "Content-Type": "application/json" } }
    );
    res.json({ success: true, fcm_response: r.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. SLACK
app.post("/send/slack", auth, async (req, res) => {
  const { webhook_url, message, channel } = req.body;
  const url = webhook_url || process.env.SLACK_WEBHOOK_URL;
  if (!url || !message)
    return res.status(400).json({ success: false, error: "webhook_url aur message chahiye" });
  try {
    await axios.post(url, { text: message, ...(channel && { channel }) });
    res.json({ success: true, message: "Slack pe bheja gaya" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── VERCEL KE LIYE EXPORT ────────────────────────────────────────────────────
module.exports = app;
