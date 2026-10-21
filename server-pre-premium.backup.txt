
/*
========================================
 FALCONI-GIT v0.8
 Backend de desarrollo local
 Node.js 24 + SQLite
========================================
*/

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);

// CONFIGURACIÓN

const HOST = "127.0.0.1";
const PORT = 3000;
const ORIGIN = `http://${HOST}:${PORT}`;
const ROOT = __dirname;

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MS = 15 * 60 * 1000;

if (process.env.NODE_ENV === "production") {
    throw new Error(
        "Este servidor es únicamente para desarrollo local."
    );
}

// ========================================
// BASE DE DATOS
// ========================================

const dataDir = path.join(ROOT, "data");

fs.mkdirSync(dataDir, {
    recursive: true
});

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
        FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL
            CHECK(type IN ('income', 'expense')),
        description TEXT NOT NULL,
        category TEXT NOT NULL
            CHECK(category IN (
                'food', 'transport', 'housing',
                'study', 'salary', 'other'
            )),
        amount_kopeks INTEGER NOT NULL
            CHECK(
                amount_kopeks >= 1
                AND amount_kopeks <= 99999999999
            ),
        created_at INTEGER NOT NULL,
        FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movements_user
        ON movements(user_id, created_at);
`);

// ========================================
// UTILIDADES DE SEGURIDAD
// ========================================

function token() {
    return crypto.randomBytes(32).toString("hex");
}

function tokenHash(value) {
    return crypto.createHash("sha256")
        .update(value)
        .digest("hex");
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);

    return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    if (typeof stored !== "string") {
        return false;
    }

    const [salt, hash] = stored.split(":");

    if (
        !salt ||
        !/^[a-f0-9]{128}$/.test(hash || "")
    ) {
        return false;
    }

    const actual = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, "hex");

    return crypto.timingSafeEqual(actual, expected);
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
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer"
    });

    res.end(JSON.stringify(data));
}

async function readBody(req) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;

        if (size > 10000) {
            throw new Error("REQUEST_TOO_LARGE");
        }

        chunks.push(chunk);
    }

    let data;

    try {
        data = JSON.parse(
            Buffer.concat(chunks).toString("utf8")
        );
    } catch {
        throw new Error("INVALID_JSON");
    }

    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw new Error("INVALID_JSON");
    }

    return data;
}

// ========================================
// COOKIES Y SESIONES
// ========================================

function getCookie(req, name) {
    const parts = (req.headers.cookie || "").split(";");

    const found = parts.find(
        value => value.trim().startsWith(name + "=")
    );

    return found
        ? found.trim().slice(name.length + 1)
        : null;
}

function setCookie(res, value, maxAge) {
    res.setHeader(
        "Set-Cookie",
        `falconi_session=${value}; HttpOnly; ` +
        `SameSite=Strict; Path=/; Max-Age=${maxAge}`
    );
}

function createSession(res, userId) {
    const value = token();

    db.prepare(`
        INSERT INTO sessions(
            token_hash,
            user_id,
            expires_at
        )
        VALUES (?, ?, ?)
    `).run(
        tokenHash(value),
        userId,
        Date.now() + SESSION_MS
    );

    setCookie(res, value, SESSION_MS / 1000);
}

function clearCookie(res) {
    setCookie(res, "", 0);
}

function getSession(req) {
    const value = getCookie(req, "falconi_session");

    if (
        !value ||
        !/^[a-f0-9]{64}$/.test(value)
    ) {
        return null;
    }

    return db.prepare(`
        SELECT
            users.id,
            users.username,
            users.email
        FROM sessions
        JOIN users
            ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
          AND sessions.expires_at > ?
    `).get(
        tokenHash(value),
        Date.now()
    ) || null;
}

// ========================================
// LÍMITE DE SOLICITUDES
// ========================================

const attempts = new Map();

function limited(req, action, maximum = 10) {
    const key = `${req.socket.remoteAddress}:${action}`;
    const now = Date.now();

    let record = attempts.get(key);

    if (!record || now >= record.expires) {
        record = {
            count: 0,
            expires: now + 15 * 60 * 1000
        };
    }

    record.count++;
    attempts.set(key, record);

    return record.count > maximum;
}

// ========================================
// VALIDACIÓN DE MOVIMIENTOS
// ========================================

const VALID_TYPES = [
    "income",
    "expense"
];

const VALID_CATEGORIES = [
    "food",
    "transport",
    "housing",
    "study",
    "salary",
    "other"
];

function parseMovement(body) {
    const type = body.type;
    const category = body.category;

    const description =
        typeof body.description === "string"
            ? body.description.trim()
            : "";

    const amount = body.amount_kopeks;

    if (
        !VALID_TYPES.includes(type) ||
        !VALID_CATEGORIES.includes(category) ||
        description.length < 1 ||
        description.length > 100 ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 99999999999
    ) {
        return null;
    }

    return {
        type,
        category,
        description,
        amount
    };
}

// ========================================
// API
// ========================================

let dummyHash = null;

async function api(req, res, pathname) {

    // REGISTRO
    if (
        pathname === "/api/register" &&
        req.method === "POST"
    ) {
        if (limited(req, "register", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readBody(req);

        const username =
            typeof body.username === "string"
                ? body.username.trim()
                : "";

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        if (
            username.length < 3 ||
            username.length > 40 ||
            !validEmail(email) ||
            !validPassword(body.password)
        ) {
            return json(res, 400, {
                error: "Datos de registro inválidos."
            });
        }

        const existing = db.prepare(`
            SELECT id
            FROM users
            WHERE email = ?
        `).get(email);

        if (existing) {
            return json(res, 409, {
                error: "No se pudo registrar este correo."
            });
        }

        const passwordHash =
            await hashPassword(body.password);

        const result = db.prepare(`
            INSERT INTO users(
                username,
                email,
                password_hash,
                created_at
            )
            VALUES (?, ?, ?, ?)
        `).run(
            username,
            email,
            passwordHash,
            Date.now()
        );

        createSession(
            res,
            Number(result.lastInsertRowid)
        );

        return json(res, 201, { ok: true });
    }

    // INICIO DE SESIÓN
    if (
        pathname === "/api/login" &&
        req.method === "POST"
    ) {
        if (limited(req, "login", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readBody(req);

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        if (
            !validEmail(email) ||
            typeof body.password !== "string" ||
            body.password.length > 128
        ) {
            return json(res, 401, {
                error: "Credenciales incorrectas."
            });
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
        `).get(email);

        const verified = await verifyPassword(
            body.password,
            user ? user.password_hash : dummyHash
        );

        if (!user || !verified) {
            return json(res, 401, {
                error: "Credenciales incorrectas."
            });
        }

        createSession(res, user.id);

        return json(res, 200, { ok: true });
    }

    // USUARIO ACTUAL
    if (
        pathname === "/api/me" &&
        req.method === "GET"
    ) {
        const user = getSession(req);

        return user
            ? json(res, 200, { user })
            : json(res, 401, {
                error: "Sin sesión."
            });
    }

    // CERRAR SESIÓN
    if (
        pathname === "/api/logout" &&
        req.method === "POST"
    ) {
        const value = getCookie(
            req,
            "falconi_session"
        );

        if (
            value &&
            /^[a-f0-9]{64}$/.test(value)
        ) {
            db.prepare(`
                DELETE FROM sessions
                WHERE token_hash = ?
            `).run(tokenHash(value));
        }

        clearCookie(res);

        return json(res, 200, { ok: true });
    }

    // RECUPERACIÓN DE CONTRASEÑA
    if (
        pathname === "/api/forgot-password" &&
        req.method === "POST"
    ) {
        if (limited(req, "forgot", 5)) {
            return json(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readBody(req);

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        const user = validEmail(email)
            ? db.prepare(`
                SELECT id
                FROM users
                WHERE email = ?
            `).get(email)
            : null;

        if (user) {
            const value = token();

            db.prepare(`
                DELETE FROM password_resets
                WHERE user_id = ?
            `).run(user.id);

            db.prepare(`
                INSERT INTO password_resets(
                    token_hash,
                    user_id,
                    expires_at
                )
                VALUES (?, ?, ?)
            `).run(
                tokenHash(value),
                user.id,
                Date.now() + RESET_MS
            );

            console.log(
                "\n--- RECUPERACIÓN FALCONI-GIT ---"
            );

            console.log(
                `${ORIGIN}/reset-password.html?token=${value}`
            );

            console.log(
                "Enlace válido durante 15 minutos.\n"
            );
        }

        return json(res, 200, {
            ok: true,
            message:
                "Si existe una cuenta, se han generado las instrucciones."
        });
    }

    // RESTABLECER CONTRASEÑA
    if (
        pathname === "/api/reset-password" &&
        req.method === "POST"
    ) {
        if (limited(req, "reset", 10)) {
            return json(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readBody(req);

        if (
            typeof body.token !== "string" ||
            !/^[a-f0-9]{64}$/.test(body.token) ||
            !validPassword(body.password)
        ) {
            return json(res, 400, {
                error: "Enlace o contraseña inválidos."
            });
        }

        const record = db.prepare(`
            SELECT user_id
            FROM password_resets
            WHERE token_hash = ?
              AND expires_at > ?
        `).get(
            tokenHash(body.token),
            Date.now()
        );

        if (!record) {
            return json(res, 400, {
                error: "El enlace ha caducado."
            });
        }

        const passwordHash =
            await hashPassword(body.password);

        db.exec("BEGIN IMMEDIATE");

        try {
            const consumed = db.prepare(`
                DELETE FROM password_resets
                WHERE token_hash = ?
                  AND expires_at > ?
            `).run(
                tokenHash(body.token),
                Date.now()
            );

            if (consumed.changes !== 1) {
                db.exec("ROLLBACK");

                return json(res, 400, {
                    error: "Enlace inválido."
                });
            }

            db.prepare(`
                UPDATE users
                SET password_hash = ?
                WHERE id = ?
            `).run(
                passwordHash,
                record.user_id
            );

            db.prepare(`
                DELETE FROM password_resets
                WHERE user_id = ?
            `).run(record.user_id);

            db.prepare(`
                DELETE FROM sessions
                WHERE user_id = ?
            `).run(record.user_id);

            db.exec("COMMIT");

        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        clearCookie(res);

        return json(res, 200, { ok: true });
    }

    // ====================================
    // CONSULTAR MOVIMIENTOS
    // ====================================

    if (
        pathname === "/api/movements" &&
        req.method === "GET"
    ) {
        const user = getSession(req);

        if (!user) {
            return json(res, 401, {
                error: "Sin sesión."
            });
        }

        const movements = db.prepare(`
            SELECT
                id,
                type,
                description,
                category,
                amount_kopeks,
                created_at
            FROM movements
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
        `).all(user.id);

        return json(res, 200, {
            movements
        });
    }

    // ====================================
    // CREAR MOVIMIENTO
    // ====================================

    if (
        pathname === "/api/movements" &&
        req.method === "POST"
    ) {
        const user = getSession(req);

        if (!user) {
            return json(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "create-movement", 100)) {
            return json(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const movement = parseMovement(
            await readBody(req)
        );

        if (!movement) {
            return json(res, 400, {
                error: "Movimiento inválido."
            });
        }

        const count = db.prepare(`
            SELECT COUNT(*) AS total
            FROM movements
            WHERE user_id = ?
        `).get(user.id);

        if (count.total >= 1000) {
            return json(res, 409, {
                error: "Límite de movimientos alcanzado."
            });
        }

        const result = db.prepare(`
            INSERT INTO movements(
                user_id,
                type,
                description,
                category,
                amount_kopeks,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            user.id,
            movement.type,
            movement.description,
            movement.category,
            movement.amount,
            Date.now()
        );

        return json(res, 201, {
            ok: true,
            id: Number(result.lastInsertRowid)
        });
    }

    const match = pathname.match(
        /^\/api\/movements\/([1-9][0-9]*)$/
    );

    // ====================================
    // EDITAR MOVIMIENTO
    // NUEVO EN V0.8
    // ====================================

    if (
        match &&
        req.method === "PATCH"
    ) {
        const user = getSession(req);

        if (!user) {
            return json(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "edit-movement", 100)) {
            return json(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const id = Number(match[1]);

        if (!Number.isSafeInteger(id)) {
            return json(res, 400, {
                error: "ID inválido."
            });
        }

        const movement = parseMovement(
            await readBody(req)
        );

        if (!movement) {
            return json(res, 400, {
                error: "Movimiento inválido."
            });
        }

        const result = db.prepare(`
            UPDATE movements

            SET type = ?,
                description = ?,
                category = ?,
                amount_kopeks = ?

            WHERE id = ?
              AND user_id = ?
        `).run(
            movement.type,
            movement.description,
            movement.category,
            movement.amount,
            id,
            user.id
        );

        if (result.changes !== 1) {
            return json(res, 404, {
                error: "Movimiento no encontrado."
            });
        }

        return json(res, 200, { ok: true });
    }

    // ====================================
    // ELIMINAR MOVIMIENTO
    // ====================================

    if (
        match &&
        req.method === "DELETE"
    ) {
        const user = getSession(req);

        if (!user) {
            return json(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "delete-movement", 100)) {
            return json(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const id = Number(match[1]);

        if (!Number.isSafeInteger(id)) {
            return json(res, 400, {
                error: "ID inválido."
            });
        }

        const result = db.prepare(`
            DELETE FROM movements
            WHERE id = ?
              AND user_id = ?
        `).run(id, user.id);

        if (result.changes !== 1) {
            return json(res, 404, {
                error: "Movimiento no encontrado."
            });
        }

        return json(res, 200, { ok: true });
    }

    return json(res, 404, {
        error: "Ruta de API no encontrada."
    });
}

// ========================================
// ARCHIVOS PERMITIDOS
// ========================================

const FILES = new Map([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/register.html", "register.html"],
    ["/forgot-password.html", "forgot-password.html"],
    ["/reset-password.html", "reset-password.html"],
    ["/dashboard.html", "dashboard.html"],
    ["/movements.html", "movements.html"],

    ["/styles.css", "styles.css"],
    ["/responsive.css", "responsive.css"],
    ["/dashboard.css", "dashboard.css"],
    ["/movements.css", "movements.css"],

    ["/login.js", "login.js"],
    ["/register.js", "register.js"],
    ["/forgot-password.js", "forgot-password.js"],
    ["/reset-password.js", "reset-password.js"],
    ["/dashboard.js", "dashboard.js"],
    ["/movements.js", "movements.js"],
    ["/translations.js", "translations.js"],
    ["/language.js", "language.js"]
]);

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
};

function serveFile(res, pathname) {
    let file = FILES.get(pathname);

    if (
        !file &&
        /^\/assets\/images\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|svg)$/
            .test(pathname)
    ) {
        file = pathname.slice(1);
    }

    if (!file) {
        return json(res, 404, {
            error: "Not found"
        });
    }

    const fullPath = path.join(ROOT, file);

    fs.readFile(fullPath, (error, content) => {
        if (error) {
            return json(res, 404, {
                error: "File not found"
            });
        }

        const extension = path.extname(fullPath);

        const textFile = [
            ".html",
            ".css",
            ".js"
        ].includes(extension);

        res.writeHead(200, {
            "Content-Type":
                (MIME[extension] ||
                    "application/octet-stream") +
                (textFile ? "; charset=utf-8" : ""),

            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",

            "Content-Security-Policy":
                "default-src 'self'; " +
                "script-src 'self'; " +
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

// ========================================
// INICIAR SERVIDOR
// ========================================

async function start() {
    dummyHash = await hashPassword(
        "DummyPassword12345"
    );

    const server = http.createServer(
        async (req, res) => {
            try {
                const url = new URL(
                    req.url,
                    ORIGIN
                );

                const pathname = url.pathname;

                // RUTAS API

                if (pathname.startsWith("/api/")) {

                    // Proteger operaciones
                    // que modifican información.

                    if ([
                        "POST",
                        "PATCH",
                        "DELETE"
                    ].includes(req.method)) {

                        if (
                            req.headers.origin !== ORIGIN
                        ) {
                            return json(res, 403, {
                                error: "Origen no permitido."
                            });
                        }
                    }

                    // Verificar contenido JSON.

                    if ([
                        "POST",
                        "PATCH"
                    ].includes(req.method)) {

                        const contentType =
                            req.headers["content-type"] || "";

                        if (
                            !contentType.startsWith(
                                "application/json"
                            )
                        ) {
                            return json(res, 415, {
                                error: "Se requiere JSON."
                            });
                        }
                    }

                    return await api(
                        req,
                        res,
                        pathname
                    );
                }

                // ARCHIVOS WEB

                if (req.method !== "GET") {
                    return json(res, 405, {
                        error: "Método no permitido."
                    });
                }

                // Restringir páginas privadas.

                if (
                    [
                        "/dashboard.html",
                        "/movements.html"
                    ].includes(pathname) &&
                    !getSession(req)
                ) {
                    res.writeHead(302, {
                        Location: "/index.html",
                        "Cache-Control": "no-store"
                    });

                    return res.end();
                }

                serveFile(res, pathname);

            } catch (error) {

                console.error(
                    "Error del servidor:",
                    error.message
                );

                if (!res.headersSent) {
                    return json(res, 500, {
                        error: "Error interno del servidor."
                    });
                }

                res.end();
            }
        }
    );

    server.listen(PORT, HOST, () => {
        console.log("");
        console.log("==============================");
        console.log(" FALCONI-GIT v0.8");
        console.log(` ${ORIGIN}`);
        console.log("==============================");
        console.log("");
    });
}

start().catch(error => {
    console.error(error);
    process.exitCode = 1;
});