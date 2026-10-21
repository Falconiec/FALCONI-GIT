
/*
 FALCONI-GIT - BACKEND v0.6
 Node.js 24 + SQLite
 Servidor local de desarrollo
*/

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);

const HOST = "127.0.0.1";
const PORT = 3000;
const ORIGIN = `http://${HOST}:${PORT}`;
const ROOT = __dirname;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION) {
    throw new Error(
        "Este servidor está configurado solo para desarrollo local."
    );
}

// =======================================
// BASE DE DATOS
// =======================================

const dataDir = path.join(ROOT, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(
    path.join(dataDir, "falconi.db")
);

db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
    );
`);

// =======================================
// SEGURIDAD Y UTILIDADES
// =======================================

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const RESET_DURATION = 15 * 60 * 1000;

function hashToken(token) {
    return crypto.createHash("sha256")
        .update(token)
        .digest("hex");
}

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const derived = await scrypt(
        password,
        salt,
        64
    );

    return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(":");

    if (!salt || !hash) return false;

    const expected = Buffer.from(hash, "hex");

    if (expected.length !== 64) return false;

    const actual = await scrypt(password, salt, 64);

    return crypto.timingSafeEqual(expected, actual);
}

function validPassword(value) {
    return (
        typeof value === "string" &&
        value.length >= 8 &&
        value.length <= 128 &&
        /\p{Lu}/u.test(value) &&
        /\p{Ll}/u.test(value) &&
        /\p{Nd}/u.test(value)
    );
}

function validEmail(value) {
    return (
        typeof value === "string" &&
        value.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );
}

function json(res, status, data) {
    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "default-src 'none'"
    });

    res.end(body);
}

async function readBody(req) {
    let body = "";
    let length = 0;

    for await (const chunk of req) {
        length += chunk.length;

        if (length > 10000) {
            throw new Error("REQUEST_TOO_LARGE");
        }

        body += chunk.toString("utf8");
    }

    try {
        return JSON.parse(body);
    } catch {
        throw new Error("INVALID_JSON");
    }
}

function getCookie(req, name) {
    const header = req.headers.cookie || "";

    const cookie = header.split(";").find(
        part => part.trim().startsWith(name + "=")
    );

    return cookie
        ? cookie.trim().substring(name.length + 1)
        : null;
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `falconi_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION / 1000}`
    );
}

function clearSessionCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "falconi_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    );
}

function getSession(req) {
    const token = getCookie(req, "falconi_session");

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return null;
    }

    return db.prepare(`
        SELECT users.id, users.username, users.email
        FROM sessions
        JOIN users ON sessions.user_id = users.id
        WHERE sessions.token_hash = ?
          AND sessions.expires_at > ?
    `).get(hashToken(token), Date.now()) || null;
}

function createSession(res, userId) {
    const token = generateToken();

    db.prepare(`
        INSERT INTO sessions (
            token_hash, user_id, expires_at
        )
        VALUES (?, ?, ?)
    `).run(
        hashToken(token),
        userId,
        Date.now() + SESSION_DURATION
    );

    setSessionCookie(res, token);
}

// =======================================
// LÍMITE BÁSICO DE INTENTOS
// =======================================

const attempts = new Map();

function limited(req, action, max = 10) {
    const key = `${req.socket.remoteAddress}:${action}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;

    let record = attempts.get(key);

    if (!record || now > record.expires) {
        record = { count: 0, expires: now + windowMs };
    }

    record.count++;
    attempts.set(key, record);

    return record.count > max;
}

// =======================================
// ARCHIVOS PÚBLICOS PERMITIDOS
// =======================================

const PUBLIC_FILES = new Map([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/register.html", "register.html"],
    ["/forgot-password.html", "forgot-password.html"],
    ["/reset-password.html", "reset-password.html"],
    ["/dashboard.html", "dashboard.html"],

    ["/styles.css", "styles.css"],
    ["/responsive.css", "responsive.css"],
    ["/dashboard.css", "dashboard.css"],

    ["/login.js", "login.js"],
    ["/register.js", "register.js"],
    ["/translations.js", "translations.js"],
    ["/language.js", "language.js"],
    ["/forgot-password.js", "forgot-password.js"],
    ["/reset-password.js", "reset-password.js"],
    ["/dashboard.js", "dashboard.js"]
]);

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml"
};

function serveFile(req, res, pathname) {
    let file = PUBLIC_FILES.get(pathname);

    // Permitir solamente imágenes en la carpeta prevista.
    if (
        !file &&
        /^\/assets\/images\/[a-zA-Z0-9_.-]+\.(png|jpg|svg)$/
            .test(pathname)
    ) {
        file = pathname.slice(1);
    }

    if (!file) {
        return json(res, 404, { error: "Not found" });
    }

    const fullPath = path.join(ROOT, file);

    fs.readFile(fullPath, (error, content) => {
        if (error) {
            return json(res, 404, { error: "File not found" });
        }

        const extension = path.extname(fullPath);

        res.writeHead(200, {
            "Content-Type":
                (MIME[extension] || "application/octet-stream") +
                (extension === ".html" ||
                 extension === ".css" ||
                 extension === ".js"
                    ? "; charset=utf-8"
                    : ""),
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "connect-src 'self'; " +
                "object-src 'none'; " +
                "frame-ancestors 'none'; " +
                "base-uri 'self'"
        });

        res.end(content);
    });
}

// =======================================
// API
// =======================================

async function api(req, res, pathname) {

    // Registro real
    if (pathname === "/api/register" && req.method === "POST") {

        if (limited(req, "register", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos. Prueba más tarde."
            });
        }

        const body = await readBody(req);

        const username = String(body.username || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = body.password;

        if (
            username.length < 3 ||
            username.length > 40 ||
            !validEmail(email) ||
            !validPassword(password)
        ) {
            return json(res, 400, {
                error: "Datos de registro inválidos."
            });
        }

        const exists = db.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).get(email);

        if (exists) {
            return json(res, 409, {
                error: "No se pudo registrar este correo."
            });
        }

        const passwordHash = await hashPassword(password);

        const result = db.prepare(`
            INSERT INTO users (
                username, email, password_hash, created_at
            )
            VALUES (?, ?, ?, ?)
        `).run(username, email, passwordHash, Date.now());

        createSession(res, Number(result.lastInsertRowid));

        return json(res, 201, { ok: true });
    }

    // Inicio de sesión real
    if (pathname === "/api/login" && req.method === "POST") {

        if (limited(req, "login", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos. Prueba más tarde."
            });
        }

        const body = await readBody(req);

        const email = String(body.email || "").trim().toLowerCase();
        const password = body.password;

        if (
            !validEmail(email) ||
            typeof password !== "string" ||
            password.length > 128
        ) {
            return json(res, 401, {
                error: "Correo o contraseña incorrectos."
            });
        }

        const user = db.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).get(email);

        const verified = user
            ? await verifyPassword(password, user.password_hash)
            : await verifyPassword(
                password,
                awaitDummyHash
            );

        if (!user || !verified) {
            return json(res, 401, {
                error: "Correo o contraseña incorrectos."
            });
        }

        createSession(res, user.id);

        return json(res, 200, { ok: true });
    }

    // Perfil del usuario autenticado
    if (pathname === "/api/me" && req.method === "GET") {
        const user = getSession(req);

        if (!user) {
            return json(res, 401, {
                error: "Sesión no iniciada."
            });
        }

        return json(res, 200, { user });
    }

    // Cerrar sesión
    if (pathname === "/api/logout" && req.method === "POST") {
        const token = getCookie(req, "falconi_session");

        if (token) {
            db.prepare(
                "DELETE FROM sessions WHERE token_hash = ?"
            ).run(hashToken(token));
        }

        clearSessionCookie(res);
        return json(res, 200, { ok: true });
    }

    // Solicitud de recuperación
    if (pathname === "/api/forgot-password" &&
        req.method === "POST") {

        if (limited(req, "forgot", 5)) {
            return json(res, 429, {
                error: "Demasiados intentos. Prueba más tarde."
            });
        }

        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();

        const user = validEmail(email)
            ? db.prepare(
                "SELECT id FROM users WHERE email = ?"
            ).get(email)
            : null;

        if (user) {
            const token = generateToken();

            db.prepare(
                "DELETE FROM password_resets WHERE user_id = ?"
            ).run(user.id);

            db.prepare(`
                INSERT INTO password_resets (
                    token_hash, user_id, expires_at
                )
                VALUES (?, ?, ?)
            `).run(
                hashToken(token),
                user.id,
                Date.now() + RESET_DURATION
            );

            // SOLO DESARROLLO LOCAL:
            // Más adelante sustituiremos esto
            // por el envío real de correo electrónico.
            console.log("\n--- RECUPERACIÓN FALCONI-GIT ---");
            console.log(
                `${ORIGIN}/reset-password.html?token=${token}`
            );
            console.log("Enlace válido durante 15 minutos.\n");
        }

        return json(res, 200, {
            ok: true,
            message: "Si existe una cuenta, se han generado las instrucciones."
        });
    }

    // Cambiar contraseña con token temporal
    if (pathname === "/api/reset-password" &&
        req.method === "POST") {

        if (limited(req, "reset", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos. Prueba más tarde."
            });
        }

        const body = await readBody(req);
        const token = body.token;
        const newPassword = body.password;

        if (
            typeof token !== "string" ||
            !/^[a-f0-9]{64}$/.test(token) ||
            !validPassword(newPassword)
        ) {
            return json(res, 400, {
                error: "Enlace o contraseña inválidos."
            });
        }

        const record = db.prepare(`
            SELECT user_id FROM password_resets
            WHERE token_hash = ? AND expires_at > ?
        `).get(hashToken(token), Date.now());

        if (!record) {
            return json(res, 400, {
                error: "El enlace es inválido o ha caducado."
            });
        }

        const passwordHash = await hashPassword(newPassword);

        db.exec("BEGIN IMMEDIATE");

        try {
            db.prepare(
                "UPDATE users SET password_hash = ? WHERE id = ?"
            ).run(passwordHash, record.user_id);

            db.prepare(
                "DELETE FROM password_resets WHERE user_id = ?"
            ).run(record.user_id);

            db.prepare(
                "DELETE FROM sessions WHERE user_id = ?"
            ).run(record.user_id);

            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        clearSessionCookie(res);

        return json(res, 200, { ok: true });
    }

    return json(res, 404, {
        error: "Ruta de API no encontrada."
    });
}

// Hash de demostración para verificar
// sin revelar si existe un usuario.
let awaitDummyHash = null;

// =======================================
// INICIAR SERVIDOR
// =======================================

async function start() {
    awaitDummyHash = await hashPassword(
        "DummyPassword12345"
    );

    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, ORIGIN);
            const pathname = url.pathname;

            if (pathname.startsWith("/api/")) {

                if (req.method === "POST") {
                    const origin = req.headers.origin;

                    if (origin !== ORIGIN) {
                        return json(res, 403, {
                            error: "Origen no permitido."
                        });
                    }

                    if (
                        !req.headers["content-type"] ||
                        !req.headers["content-type"]
                            .startsWith("application/json")
                    ) {
                        return json(res, 415, {
                            error: "Se requiere JSON."
                        });
                    }
                }

                return await api(req, res, pathname);
            }

            if (req.method !== "GET") {
                return json(res, 405, {
                    error: "Método no permitido."
                });
            }

            serveFile(req, res, pathname);

        } catch (error) {
            console.error("Error:", error.message);

            json(res, 500, {
                error: "Error interno del servidor."
            });
        }
    });

    server.listen(PORT, HOST, () => {
        console.log("FALCONI-GIT iniciado:");
        console.log(ORIGIN);
    });
}

start().catch(console.error);