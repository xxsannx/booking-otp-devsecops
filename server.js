// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// DB init
const db = new Database(path.join(__dirname, 'data.sqlite'));
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  booking_date TEXT,
  amount REAL,
  otp_hash TEXT,
  otp_salt TEXT,
  otp_expires INTEGER,
  is_verified INTEGER DEFAULT 0,
  created_at INTEGER
)
`).run();

// simple session store (demo). In production use Redis/session store.
const sessions = {}; // { sessionId: userId }
function requireLogin(req, res, next) {
  const sid = req.cookies.sessionId;
  if (sid && sessions[sid]) {
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(sessions[sid]);
    return next();
  }
  return res.status(401).json({ success: false, error: 'Harus login' });
}

// OTP helpers
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function hashOtp(otp, salt) {
  return crypto.createHmac('sha256', salt).update(String(otp)).digest('hex');
}

// mailer (Gmail app password recommended for dev)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
});
async function sendOtpEmail(to, otp) {
  const html = `<div style="font-family: Arial, sans-serif">
    <h3>Kode OTP Booking Anda</h3>
    <p><strong style="font-size:20px">${otp}</strong></p>
    <p>Kode berlaku 5 menit.</p></div>`;
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: 'OTP Booking',
    html
  });
}

// ---------- Auth routes ----------
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password)
    return res.status(400).json({ success: false, error: 'Data tidak lengkap' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id,name,email,phone,password_hash) VALUES (?,?,?,?,?)')
      .run(id, name, email, phone, hash);
    return res.json({ success: true, message: 'Registrasi berhasil' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.json({ success: false, error: 'Email sudah terdaftar' });
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ success: false, error: 'Email tidak ditemukan' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.json({ success: false, error: 'Password salah' });
  const sessionId = uuidv4();
  sessions[sessionId] = user.id;
  res.cookie('sessionId', sessionId, { httpOnly: true });
  return res.json({ success: true, message: 'Login berhasil' });
});

app.post('/api/logout', (req, res) => {
  const sid = req.cookies.sessionId;
  if (sid) delete sessions[sid];
  res.clearCookie('sessionId');
  res.json({ success: true, message: 'Logout berhasil' });
});

// ---------- Booking routes ----------
app.post('/api/book', requireLogin, async (req, res) => {
  const { bookingDate, amount } = req.body;
  if (!bookingDate || !amount) return res.status(400).json({ success: false, error: 'Data tidak lengkap' });
  const bookingId = uuidv4();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = generateSalt();
  const otpHash = hashOtp(otp, salt);
  const otpExpires = Date.now() + 5 * 60 * 1000;
  db.prepare(`INSERT INTO bookings (id,user_id,booking_date,amount,otp_hash,otp_salt,otp_expires,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(bookingId, req.user.id, bookingDate, amount, otpHash, salt, otpExpires, Date.now());
  sendOtpEmail(req.user.email, otp).catch(err => console.error('Mail error:', err));
  return res.json({ success: true, message: 'Booking dibuat. OTP dikirim ke email.', bookingId });
});

app.post('/api/verify', requireLogin, (req, res) => {
  const { bookingId, otp } = req.body;
  if (!bookingId || !otp) return res.status(400).json({ success: false, error: 'Missing fields' });
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(bookingId, req.user.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking tidak ditemukan' });
  if (Date.now() > booking.otp_expires) return res.json({ success: false, error: 'OTP kadaluarsa' });
  const hash = hashOtp(otp, booking.otp_salt);
  if (hash === booking.otp_hash) {
    db.prepare('UPDATE bookings SET is_verified = 1 WHERE id = ?').run(bookingId);
    return res.json({ success: true, message: 'OTP valid, booking terverifikasi' });
  } else {
    return res.json({ success: false, error: 'OTP salah' });
  }
});

// list bookings user (optional)
app.get('/api/bookings', requireLogin, (req, res) => {
  const rows = db.prepare('SELECT id,booking_date,amount,is_verified,created_at FROM bookings WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ success: true, bookings: rows });
});

// serve index
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// start server
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = { app, generateSalt, hashOtp };
