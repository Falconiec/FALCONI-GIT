
/*
 FALCONI-GIT v0.8.1
 Backend local: Node.js + SQLite

 Incluye:
 - Registro
 - Login y logout
 - Recuperación de contraseña
 - Sesiones
 - Movimientos: crear, listar, editar, eliminar
 - Dashboard
 - Tarjeta Premium 3D
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

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MS = 15 * 60 * 1000;

if (process.env.NODE_ENV === "production") {
    throw new Error(
        "Este servidor es solo para pruebas locales."
    );
}

// ========================================
// 1. BASE DE DATOS
// ========================================

// Conservamos la misma base de datos.
// No se eliminan cuentas ni movimientos.

fs.mkdirSync(
    path.join(ROOT, "data"),
    { recursive: true }
);

const db = new DatabaseSync(
    path.join(ROOT, "data", "falconi.db")
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
            CHECK(type IN ('income','expense')),

        description TEXT NOT NULL,

        category TEXT NOT NULL
            CHECK(category IN (
                'food',
                'transport',
                'housing',
                'study',
                'salary',
                'other'
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
// 2. CONTRASEÑAS Y TOKENS
// ========================================

function randomToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function tokenHash(value) {
    return crypto
        .createHash("sha256")
        .update(value)
        .digest("hex");
}

async function hashPassword(password) {
    const salt = crypto
        .randomBytes(16)
        .toString("hex");

    const digest = await scrypt(
        password,
        salt,
        64
    );

    return `${salt}:${digest.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    if (typeof stored !== "string") {
        return false;
    }

    const [salt, hash] = stored.split(":");

    if (
        !/^[a-f0-9]{32}$/.test(salt || "") ||
        !/^[a-f0-9]{128}$/.test(hash || "")
    ) {
        return false;
    }

    const actual = await scrypt(
        password,
        salt,
        64
    );

    const expected = Buffer.from(
        hash,
        "hex"
    );

    return crypto.timingSafeEqual(
        actual,
        expected
    );
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

// ========================================
// 3. RESPUESTAS DEL SERVIDOR
// ========================================

function sendJSON(res, status, payload) {
    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8",

        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer"
    });

    res.end(JSON.stringify(payload));
}

async function readJSON(req) {
    let size = 0;
    const chunks = [];

    for await (const chunk of req) {
        size += chunk.length;

        if (size > 10000) {
            throw new Error("BAD_JSON");
        }

        chunks.push(chunk);
    }

    let value;

    try {
        value = JSON.parse(
            Buffer.concat(chunks).toString("utf8")
        );
    } catch {
        throw new Error("BAD_JSON");
    }

    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error("BAD_JSON");
    }

    return value;
}

// ========================================
// 4. COOKIES Y SESIONES
// ========================================

function cookie(req, name) {
    const entry = (req.headers.cookie || "")
        .split(";")
        .map(x => x.trim())
        .find(x => x.startsWith(`${name}=`));

    return entry
        ? entry.slice(name.length + 1)
        : null;
}

function setSessionCookie(res, value, maxAge) {
    res.setHeader(
        "Set-Cookie",
        `falconi_session=${value}; ` +
        "HttpOnly; SameSite=Strict; Path=/; " +
        `Max-Age=${maxAge}`
    );
}

function openSession(res, userId) {
    const value = randomToken();

    db.prepare(`
        INSERT INTO sessions(
            token_hash,
            user_id,
            expires_at
        )
        VALUES(?, ?, ?)
    `).run(
        tokenHash(value),
        userId,
        Date.now() + SESSION_MS
    );

    setSessionCookie(
        res,
        value,
        SESSION_MS / 1000
    );
}

function getSession(req) {
    const value = cookie(
        req,
        "falconi_session"
    );

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
// 5. LÍMITES DE SOLICITUDES
// ========================================

const rateLimits = new Map();

function limited(req, action, max = 10) {
    const key =
        `${req.socket.remoteAddress}:${action}`;

    const now = Date.now();

    let item = rateLimits.get(key);

    if (!item || now >= item.expires) {
        item = {
            count: 0,
            expires: now + 15 * 60 * 1000
        };
    }

    item.count++;

    rateLimits.set(key, item);

    return item.count > max;
}

// ========================================
// 6. VALIDAR MOVIMIENTOS
// ========================================

const TYPES = ["income", "expense"];

const CATEGORIES = [
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
        !TYPES.includes(type) ||
        !CATEGORIES.includes(category) ||
        !description ||
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
// 7. API DEL SERVIDOR
// ========================================

let dummyHash;

async function api(req, res, pathname) {
    const method = req.method;

    // ------------------------------------
    // REGISTRO
    // ------------------------------------

    if (
        pathname === "/api/register" &&
        method === "POST"
    ) {
        if (limited(req, "register")) {
            return sendJSON(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readJSON(req);

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
            return sendJSON(res, 400, {
                error: "Datos de registro inválidos."
            });
        }

        const existing = db.prepare(`
            SELECT id
            FROM users
            WHERE email = ?
        `).get(email);

        if (existing) {
            return sendJSON(res, 409, {
                error: "No se pudo registrar este correo."
            });
        }

        const passHash = await hashPassword(
            body.password
        );

        const result = db.prepare(`
            INSERT INTO users(
                username,
                email,
                password_hash,
                created_at
            )
            VALUES(?, ?, ?, ?)
        `).run(
            username,
            email,
            passHash,
            Date.now()
        );

        openSession(
            res,
            Number(result.lastInsertRowid)
        );

        return sendJSON(res, 201, {
            ok: true
        });
    }

    // ------------------------------------
    // LOGIN
    // ------------------------------------

    if (
        pathname === "/api/login" &&
        method === "POST"
    ) {
        if (limited(req, "login")) {
            return sendJSON(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readJSON(req);

        const email =
            typeof body.email === "string"
                ? body.email.trim().toLowerCase()
                : "";

        if (
            !validEmail(email) ||
            typeof body.password !== "string" ||
            body.password.length > 128
        ) {
            return sendJSON(res, 401, {
                error: "Credenciales incorrectas."
            });
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
        `).get(email);

        const valid = await verifyPassword(
            body.password,
            user ? user.password_hash : dummyHash
        );

        if (!user || !valid) {
            return sendJSON(res, 401, {
                error: "Credenciales incorrectas."
            });
        }

        openSession(res, user.id);

        return sendJSON(res, 200, {
            ok: true
        });
    }

    // ------------------------------------
    // PERFIL
    // ------------------------------------

    if (
        pathname === "/api/me" &&
        method === "GET"
    ) {
        const user = getSession(req);

        return user
            ? sendJSON(res, 200, { user })
            : sendJSON(res, 401, {
                error: "Sin sesión."
            });
    }

    // ------------------------------------
    // CERRAR SESIÓN
    // ------------------------------------

    if (
        pathname === "/api/logout" &&
        method === "POST"
    ) {
        const value = cookie(
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

        setSessionCookie(res, "", 0);

        return sendJSON(res, 200, {
            ok: true
        });
    }

    // ------------------------------------
    // SOLICITAR RECUPERACIÓN
    // ------------------------------------

    if (
        pathname === "/api/forgot-password" &&
        method === "POST"
    ) {
        if (limited(req, "forgot", 5)) {
            return sendJSON(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readJSON(req);

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
            const value = randomToken();

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
                VALUES(?, ?, ?)
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
                "Enlace válido 15 minutos. No lo compartas.\n"
            );
        }

        return sendJSON(res, 200, {
            ok: true,
            message:
                "Si existe una cuenta, se han generado las instrucciones."
        });
    }

    // ------------------------------------
    // RESTABLECER CONTRASEÑA
    // ------------------------------------

    if (
        pathname === "/api/reset-password" &&
        method === "POST"
    ) {
        if (limited(req, "reset")) {
            return sendJSON(res, 429, {
                error: "Demasiados intentos."
            });
        }

        const body = await readJSON(req);

        if (
            typeof body.token !== "string" ||
            !/^[a-f0-9]{64}$/.test(body.token) ||
            !validPassword(body.password)
        ) {
            return sendJSON(res, 400, {
                error: "Enlace o contraseña inválidos."
            });
        }

        const tokenDigest = tokenHash(body.token);

        const record = db.prepare(`
            SELECT user_id
            FROM password_resets
            WHERE token_hash = ?
              AND expires_at > ?
        `).get(
            tokenDigest,
            Date.now()
        );

        if (!record) {
            return sendJSON(res, 400, {
                error: "El enlace ha caducado."
            });
        }

        const passHash = await hashPassword(
            body.password
        );

        db.exec("BEGIN IMMEDIATE");

        try {
            const consumed = db.prepare(`
                DELETE FROM password_resets
                WHERE token_hash = ?
                  AND expires_at > ?
            `).run(
                tokenDigest,
                Date.now()
            );

            if (consumed.changes !== 1) {
                db.exec("ROLLBACK");

                return sendJSON(res, 400, {
                    error: "Enlace inválido."
                });
            }

            db.prepare(`
                UPDATE users
                SET password_hash = ?
                WHERE id = ?
            `).run(
                passHash,
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

        setSessionCookie(res, "", 0);

        return sendJSON(res, 200, {
            ok: true
        });
    }

    // ------------------------------------
    // LISTAR MOVIMIENTOS
    // ------------------------------------

    if (
        pathname === "/api/movements" &&
        method === "GET"
    ) {
        const user = getSession(req);

        if (!user) {
            return sendJSON(res, 401, {
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

        return sendJSON(res, 200, {
            movements
        });
    }

    // ------------------------------------
    // CREAR MOVIMIENTO
    // ------------------------------------

    if (
        pathname === "/api/movements" &&
        method === "POST"
    ) {
        const user = getSession(req);

        if (!user) {
            return sendJSON(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "create-movement", 100)) {
            return sendJSON(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const movement = parseMovement(
            await readJSON(req)
        );

        if (!movement) {
            return sendJSON(res, 400, {
                error: "Movimiento inválido."
            });
        }

        const count = db.prepare(`
            SELECT COUNT(*) AS total
            FROM movements
            WHERE user_id = ?
        `).get(user.id);

        if (count.total >= 1000) {
            return sendJSON(res, 409, {
                error: "Límite de movimientos."
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
            VALUES(?, ?, ?, ?, ?, ?)
        `).run(
            user.id,
            movement.type,
            movement.description,
            movement.category,
            movement.amount,
            Date.now()
        );

        return sendJSON(res, 201, {
            ok: true,
            id: Number(result.lastInsertRowid)
        });
    }

    // ------------------------------------
    // MOVIMIENTO INDIVIDUAL
    // ------------------------------------

    const match = pathname.match(
        /^\/api\/movements\/([1-9][0-9]*)$/
    );

    // ------------------------------------
    // EDITAR MOVIMIENTO
    // ------------------------------------

    if (
        match &&
        method === "PATCH"
    ) {
        const user = getSession(req);

        if (!user) {
            return sendJSON(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "edit-movement", 100)) {
            return sendJSON(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const id = Number(match[1]);

        if (!Number.isSafeInteger(id)) {
            return sendJSON(res, 400, {
                error: "ID inválido."
            });
        }

        const movement = parseMovement(
            await readJSON(req)
        );

        if (!movement) {
            return sendJSON(res, 400, {
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
            return sendJSON(res, 404, {
                error: "Movimiento no encontrado."
            });
        }

        return sendJSON(res, 200, {
            ok: true
        });
    }

    // ------------------------------------
    // ELIMINAR MOVIMIENTO
    // ------------------------------------

    if (
        match &&
        method === "DELETE"
    ) {
        const user = getSession(req);

        if (!user) {
            return sendJSON(res, 401, {
                error: "Sin sesión."
            });
        }

        if (limited(req, "delete-movement", 100)) {
            return sendJSON(res, 429, {
                error: "Demasiadas solicitudes."
            });
        }

        const id = Number(match[1]);

        if (!Number.isSafeInteger(id)) {
            return sendJSON(res, 400, {
                error: "ID inválido."
            });
        }

        const result = db.prepare(`
            DELETE FROM movements
            WHERE id = ?
              AND user_id = ?
        `).run(
            id,
            user.id
        );

        if (result.changes !== 1) {
            return sendJSON(res, 404, {
                error: "Movimiento no encontrado."
            });
        }

        return sendJSON(res, 200, {
            ok: true
        });
    }

    // ------------------------------------
    // RUTA NO ENCONTRADA
    // ------------------------------------

    return sendJSON(res, 404, {
        error: "Ruta de API no encontrada."
    });
}

// ========================================
// 8. ARCHIVOS PERMITIDOS
// ========================================

// Aquí estaban las rutas que faltaban.

const FILES = new Map([

    // PÁGINAS
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/register.html", "register.html"],
    ["/forgot-password.html", "forgot-password.html"],
    ["/reset-password.html", "reset-password.html"],
    ["/dashboard.html", "dashboard.html"],
    ["/movements.html", "movements.html"],

    // CSS
    ["/styles.css", "styles.css"],
    ["/responsive.css", "responsive.css"],
    ["/dashboard.css", "dashboard.css"],
    ["/movements.css", "movements.css"],

    // PREMIUM CSS - NUEVO
    ["/premium-card.css", "premium-card.css"],

    // JAVASCRIPT
    ["/login.js", "login.js"],
    ["/register.js", "register.js"],
    ["/forgot-password.js", "forgot-password.js"],
    ["/reset-password.js", "reset-password.js"],
    ["/dashboard.js", "dashboard.js"],
    ["/movements.js", "movements.js"],
    ["/translations.js", "translations.js"],
    ["/language.js", "language.js"],

    // PREMIUM JS - NUEVO
    ["/premium-card.js", "premium-card.js"]

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

// ========================================
// 9. SERVIR ARCHIVOS
// ========================================

function serveFile(res, pathname) {
    let filename = FILES.get(pathname);

    // Imágenes de la marca
    if (
        !filename &&
        /^\/assets\/images\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|svg)$/
            .test(pathname)
    ) {
        filename = pathname.slice(1);
    }

    if (!filename) {
        return sendJSON(res, 404, {
            error: "Not found"
        });
    }

    fs.readFile(
        path.join(ROOT, filename),
        (error, content) => {

            if (error) {
                return sendJSON(res, 404, {
                    error: "File not found"
                });
            }

            const ext = path.extname(filename);

            const textual = [
                ".html",
                ".css",
                ".js"
            ].includes(ext);

            res.writeHead(200, {
                "Content-Type":
                    (
                        MIME[ext] ||
                        "application/octet-stream"
                    ) +
                    (
                        textual
                            ? "; charset=utf-8"
                            : ""
                    ),

                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "no-referrer",

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
        }
    );
}

// ========================================
// 10. INICIAR SERVIDOR
// ========================================

async function start() {
    dummyHash = await hashPassword(
        "DummyPassword12345"
    );

    const server = http.createServer(
        async (req, res) => {
            try {
                const pathname = new URL(
                    req.url,
                    ORIGIN
                ).pathname;

                // API
                if (pathname.startsWith("/api/")) {

                    // Proteger operaciones que cambian datos
                    if (
                        [
                            "POST",
                            "PATCH",
                            "DELETE"
                        ].includes(req.method) &&
                        req.headers.origin !== ORIGIN
                    ) {
                        return sendJSON(res, 403, {
                            error: "Origen no permitido."
                        });
                    }

                    // Las operaciones con cuerpo usan JSON
                    if (
                        [
                            "POST",
                            "PATCH"
                        ].includes(req.method) &&
                        !(
                            req.headers["content-type"] || ""
                        ).startsWith("application/json")
                    ) {
                        return sendJSON(res, 415, {
                            error: "Se requiere JSON."
                        });
                    }

                    return await api(
                        req,
                        res,
                        pathname
                    );
                }

                if (req.method !== "GET") {
                    return sendJSON(res, 405, {
                        error: "Método no permitido."
                    });
                }

                // Proteger las páginas privadas
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
                    "Error FALCONI-GIT:",
                    error.message
                );

                if (!res.headersSent) {
                    const badJSON =
                        error.message === "BAD_JSON";

                    return sendJSON(
                        res,
                        badJSON ? 400 : 500,
                        {
                            error: badJSON
                                ? "JSON inválido."
                                : "Error interno."
                        }
                    );
                }

                res.end();
            }
        }
    );

    server.listen(PORT, HOST, () => {
        console.log("");
        console.log("==================================");
        console.log(" FALCONI-GIT v0.8.1");
        console.log(` ${ORIGIN}`);
        console.log("==================================");
        console.log("");
    });
}

start().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
