require('dotenv').config();
const express    = require('express');
const bcrypt     = require('bcryptjs');
const nodemailer = require("nodemailer");
const crypto     = require("node:crypto");
const mysql      = require("mysql2/promise");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

var server = express();

const conn = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

server.set('trust proxy', 1);
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

function signToken(data, ttlMs) {
    const payload = { ...data, exp: Date.now() + ttlMs };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig  = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    return body + '.' + sig;
}

function verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.exp || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    header.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    });
    return out;
}

server.use((req, res, next) => {
    req.user = null;
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.auth) {
        const payload = verifyToken(cookies.auth);
        if (payload) req.user = { name: payload.name, email: payload.email };
    }
    next();
});

server.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const isHtml = req.path === '/' || req.path.endsWith('.html');
    if (!isHtml) return next();

    const publicPages = ['/login.html', '/changePassword', '/changePassword.html'];
    if (!req.user && !publicPages.includes(req.path)) return res.redirect('/login.html');
    if (req.user && req.path === '/login.html') return res.redirect('/');
    next();
});

server.use(express.static(__dirname + "/public"));

server.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

server.get("/changePassword", (req, res) => {
    res.sendFile(__dirname + "/public/changePassword.html");
});

function setAuthCookie(res, user, remember) {
    const ttl = remember ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    const token = signToken({ name: user.name, email: user.email }, ttl);

    const parts = [
        `auth=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(ttl / 1000)}`
    ];
    if (process.env.NODE_ENV === 'production') parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', 'auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

server.get("/api/me", (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    res.json({ user: req.user });
});

server.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, remember } = req.body || {};
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Заполните все поля' });

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 3) return res.status(400).json({ error: 'Логин минимум 3 символа' });
        if (password.length < 4)    return res.status(400).json({ error: 'Пароль минимум 4 символа' });

        const [existing] = await conn.query(
            "SELECT id FROM users WHERE name = ? OR email = ? LIMIT 1",
            [trimmedName, trimmedEmail]
        );
        if (existing.length) return res.status(409).json({ error: 'Логин или email уже заняты' });

        const hash = await bcrypt.hash(password, 10);
        await conn.query(
            "INSERT INTO users (name, email, pass, ForgotPass) VALUES (?, ?, ?, 0)",
            [trimmedName, trimmedEmail, hash]
        );

        setAuthCookie(res, { name: trimmedName, email: trimmedEmail }, remember);
        res.json({ ok: true, user: { name: trimmedName, email: trimmedEmail } });
    } catch (e) {
        console.error('register:', e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

server.post("/api/login", async (req, res) => {
    try {
        const { name, password, remember } = req.body || {};
        if (!name || !password)
            return res.status(400).json({ error: 'Заполните все поля' });

        const [rows] = await conn.query(
            "SELECT id, name, email, pass FROM users WHERE name = ? OR email = ? LIMIT 1",
            [name.trim(), name.trim().toLowerCase()]
        );
        if (!rows.length) return res.status(401).json({ error: 'Неверный логин или пароль' });

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.pass);
        if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });

        setAuthCookie(res, { name: user.name, email: user.email }, remember);
        res.json({ ok: true, user: { name: user.name, email: user.email } });
    } catch (e) {
        console.error('login:', e);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

server.post("/api/logout", (req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});

const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

server.post("/newPass", async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const Message = "Если аккаунт с таким email существует, временный пароль отправлен на почту";
    const tempPassword = crypto.randomBytes(12).toString("base64url");

    if (!email || email.length > 255) {
        return res.status(400).json({ message: "Укажите корректный email" });
    }

    try {
        const [result] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
        if (result.length === 0) {
            return res.json({ message: Message });
        }

        const tempHash = await bcrypt.hash(tempPassword, 10);
        await conn.query(
            "UPDATE users SET pass = ?, ForgotPass = 1 WHERE email = ?",
            [tempHash, email]
        );

        await transport.sendMail({
            from: process.env.MAIL_FROM,
            to: email,
            subject: "Смена пароля",
            text: `Ваш временный пароль: ${tempPassword}.\n` +
                  "После входа обязательно смените его на новый."
        });

        return res.json({ message: Message });
    } catch (error) {
        console.log("Ошибка отправки письма", error);
        return res.status(500).json({
            message: "Не удалось отправить письмо. Проблема с почтовым сервером. Попробуйте позже"
        });
    }
});

server.post("/changeNewPass", async (req, res) => {
    const email      = (req.body.email || '').trim().toLowerCase();
    const tempPass   = (req.body.tempPass || '').trim();
    const newPass    = (req.body.newPass || '').trim();
    const newPassConfirm = (req.body.newPassConfirm || '').trim();

    if (!email || !tempPass || !newPass || !newPassConfirm) {
        return res.status(400).json({ message: "Заполните все поля" });
    }
    if (newPass !== newPassConfirm) {
        return res.status(400).json({ message: "Пароли не совпадают" });
    }
    if (newPass.length < 4) {
        return res.status(400).json({ message: "Пароль минимум 4 символа" });
    }

    try {
        const [results] = await conn.query(
            "SELECT id, pass FROM users WHERE email = ? AND ForgotPass = 1",
            [email]
        );
        if (results.length === 0) {
            return res.status(404).json({ message: "Пользователь не найден или нет активного сброса" });
        }

        const ok = await bcrypt.compare(tempPass, results[0].pass);
        if (!ok) return res.status(401).json({ message: "Неверный временный пароль" });

        const newHash = await bcrypt.hash(newPass, 10);
        await conn.query(
            "UPDATE users SET pass = ?, ForgotPass = 0 WHERE id = ?",
            [newHash, results[0].id]
        );

        return res.json({ message: "Пароль успешно сменён" });
    } catch (error) {
        console.log("Ошибка смены пароля", error);
        return res.status(500).json({ message: "Не удалось сменить пароль." });
    }
});

conn.query('SELECT 1')
    .then(() => {
        console.log("✓ MySQL подключён");
        server.listen(PORT, () => console.log("Сервер запущен на " + PORT + " порту"));
    })
    .catch(e => {
        console.error("✗ Не удалось подключиться к MySQL:", e.message);
        process.exit(1);
    });