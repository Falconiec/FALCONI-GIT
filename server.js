
/*
==========================================
 FALCONI-GIT
 Backend v0.7

 Node.js + SQLite

 Funcionalidades:
 - Registro de usuarios
 - Inicio de sesión
 - Cierre de sesión
 - Recuperación de contraseña
 - Dashboard
 - Registro de ingresos y gastos
 - Consulta de movimientos
 - Eliminación de movimientos
==========================================
*/

"use strict";

// ==========================================
// 1. IMPORTAR MÓDULOS
// ==========================================

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);


// ==========================================
// 2. CONFIGURACIÓN DEL SERVIDOR
// ==========================================

const HOST = "127.0.0.1";
const PORT = 3000;

const ORIGIN = `http://${HOST}:${PORT}`;

const ROOT = __dirname;

if (process.env.NODE_ENV === "production") {
    throw new Error(
        "Este servidor es solo para desarrollo local."
    );
}


// ==========================================
// 3. BASE DE DATOS
// ==========================================

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
`);


// ==========================================
// 4. TABLA DE USUARIOS
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        username TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE,

        password_hash TEXT NOT NULL,

        created_at INTEGER NOT NULL
    );
`);


// ==========================================
// 5. TABLA DE SESIONES
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,

        user_id INTEGER NOT NULL,

        expires_at INTEGER NOT NULL,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);


// ==========================================
// 6. RECUPERACIÓN DE CONTRASEÑAS
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,

        user_id INTEGER NOT NULL,

        expires_at INTEGER NOT NULL,

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );
`);


// ==========================================
// 7. TABLA DE MOVIMIENTOS
// NUEVO EN V0.7
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        type TEXT NOT NULL
            CHECK(type IN ('income', 'expense')),

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

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_movements_user
        ON movements(user_id, created_at);
`);


// ==========================================
// 8. SEGURIDAD Y UTILIDADES
// ==========================================

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

const RESET_DURATION = 15 * 60 * 1000;


// Generar tokens aleatorios

function generateToken() {

    return crypto.randomBytes(32).toString("hex");

}


// Crear hash de token

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

}


// Crear hash de contraseña

async function hashPassword(password) {

    const salt = crypto.randomBytes(16).toString("hex");

    const derived = await scrypt(
        password,
        salt,
        64
    );

    return `${salt}:${derived.toString("hex")}`;

}


// Verificar contraseña

async function verifyPassword(password, stored) {

    if (typeof stored !== "string") {
        return false;
    }

    const [salt, hash] = stored.split(":");

    if (!salt || !/^[a-f0-9]{128}$/.test(hash || "")) {
        return false;
    }

    const expected = Buffer.from(hash, "hex");

    const actual = await scrypt(
        password,
        salt,
        64
    );

    return crypto.timingSafeEqual(
        expected,
        actual
    );

}


// Validar contraseñas

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


// Validar correos electrónicos

function validEmail(value) {

    return (
        typeof value === "string" &&
        value.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    );

}


// Enviar respuestas JSON

function json(res, status, data) {

    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8",

        "Cache-Control": "no-store",

        "X-Content-Type-Options": "nosniff",

        "Referrer-Policy": "no-referrer",

        "X-Frame-Options": "DENY",

        "Content-Security-Policy":
            "default-src 'none'"
    });

    res.end(body);

}


// Leer datos enviados desde formularios

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

        const parsed = JSON.parse(body);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            throw new Error("INVALID_JSON");
        }

        return parsed;

    } catch {
        throw new Error("INVALID_JSON");
    }

}


// ==========================================
// 9. COOKIES Y SESIONES
// ==========================================

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


// Obtener usuario desde su sesión

function getSession(req) {

    const token = getCookie(
        req,
        "falconi_session"
    );

    if (
        !token ||
        !/^[a-f0-9]{64}$/.test(token)
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
            ON sessions.user_id = users.id

        WHERE sessions.token_hash = ?
          AND sessions.expires_at > ?
    `).get(
        hashToken(token),
        Date.now()
    ) || null;

}


// Crear una sesión nueva

function createSession(res, userId) {

    const token = generateToken();

    db.prepare(`
        INSERT INTO sessions (
            token_hash,
            user_id,
            expires_at
        )

        VALUES (?, ?, ?)
    `).run(
        hashToken(token),
        userId,
        Date.now() + SESSION_DURATION
    );

    setSessionCookie(res, token);

}


// ==========================================
// 10. LIMITAR INTENTOS
// ==========================================

const attempts = new Map();

function limited(req, action, max = 10) {

    const key =
        `${req.socket.remoteAddress}:${action}`;

    const now = Date.now();

    const windowMs = 15 * 60 * 1000;

    let record = attempts.get(key);

    if (
        !record ||
        now > record.expires
    ) {
        record = {
            count: 0,
            expires: now + windowMs
        };
    }

    record.count++;

    attempts.set(key, record);

    return record.count > max;

}


// ==========================================
// 11. ARCHIVOS PÚBLICOS PERMITIDOS
// ==========================================

const PUBLIC_FILES = new Map([

    // Login y autenticación

    ["/", "index.html"],

    ["/index.html", "index.html"],

    ["/register.html", "register.html"],

    ["/forgot-password.html", "forgot-password.html"],

    ["/reset-password.html", "reset-password.html"],


    // Dashboard

    ["/dashboard.html", "dashboard.html"],

    ["/dashboard.css", "dashboard.css"],

    ["/dashboard.js", "dashboard.js"],


    // NUEVO: Movimientos

    ["/movements.html", "movements.html"],

    ["/movements.css", "movements.css"],

    ["/movements.js", "movements.js"],


    // Estilos generales

    ["/styles.css", "styles.css"],

    ["/responsive.css", "responsive.css"],


    // JavaScript

    ["/login.js", "login.js"],

    ["/register.js", "register.js"],

    ["/translations.js", "translations.js"],

    ["/language.js", "language.js"],

    ["/forgot-password.js", "forgot-password.js"],

    ["/reset-password.js", "reset-password.js"]

]);


const MIME = {

    ".html": "text/html",

    ".css": "text/css",

    ".js": "text/javascript",

    ".png": "image/png",

    ".jpg": "image/jpeg",

    ".svg": "image/svg+xml"

};


// ==========================================
// 12. SERVIR ARCHIVOS HTML, CSS Y JS
// ==========================================

function serveFile(req, res, pathname) {

    let file = PUBLIC_FILES.get(pathname);

    // Permitir imágenes de marca

    if (
        !file &&
        /^\/assets\/images\/[a-zA-Z0-9_.-]+\.(png|jpg|svg)$/
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


// ==========================================
// 13. API DEL SERVIDOR
// ==========================================

async function api(req, res, pathname) {

    // ======================================
    // REGISTRO DE USUARIOS
    // ======================================

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

        const exists = db.prepare(`
            SELECT id
            FROM users
            WHERE email = ?
        `).get(email);

        if (exists) {

            return json(res, 409, {
                error: "No se pudo registrar este correo."
            });

        }

        const passwordHash =
            await hashPassword(password);

        const result = db.prepare(`
            INSERT INTO users (
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

        return json(res, 201, {
            ok: true
        });

    }


    // ======================================
    // INICIAR SESIÓN
    // ======================================

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

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
        `).get(email);

        const verified = user
            ? await verifyPassword(
                password,
                user.password_hash
            )
            : await verifyPassword(
                password,
                dummyHash
            );

        if (!user || !verified) {

            return json(res, 401, {
                error: "Correo o contraseña incorrectos."
            });

        }

        createSession(res, user.id);

        return json(res, 200, {
            ok: true
        });

    }


    // ======================================
    // PERFIL DE USUARIO
    // ======================================

    if (
        pathname === "/api/me" &&
        req.method === "GET"
    ) {

        const user = getSession(req);

        if (!user) {

            return json(res, 401, {
                error: "Sesión no iniciada."
            });

        }

        return json(res, 200, {
            user
        });

    }


    // ======================================
    // CERRAR SESIÓN
    // ======================================

    if (
        pathname === "/api/logout" &&
        req.method === "POST"
    ) {

        const token = getCookie(
            req,
            "falconi_session"
        );

        if (
            token &&
            /^[a-f0-9]{64}$/.test(token)
        ) {

            db.prepare(`
                DELETE FROM sessions
                WHERE token_hash = ?
            `).run(hashToken(token));

        }

        clearSessionCookie(res);

        return json(res, 200, {
            ok: true
        });

    }


    // ======================================
    // SOLICITAR RECUPERACIÓN
    // ======================================

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

            const token = generateToken();

            db.prepare(`
                DELETE FROM password_resets
                WHERE user_id = ?
            `).run(user.id);

            db.prepare(`
                INSERT INTO password_resets (
                    token_hash,
                    user_id,
                    expires_at
                )

                VALUES (?, ?, ?)
            `).run(
                hashToken(token),
                user.id,
                Date.now() + RESET_DURATION
            );

            // Desarrollo local:
            // Mostrar enlace solamente en terminal

            console.log(
                "\n--- RECUPERACIÓN FALCONI-GIT ---"
            );

            console.log(
                `${ORIGIN}/reset-password.html?token=${token}`
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


    // ======================================
    // CAMBIAR CONTRASEÑA
    // ======================================

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
            SELECT user_id

            FROM password_resets

            WHERE token_hash = ?
              AND expires_at > ?
        `).get(
            hashToken(token),
            Date.now()
        );

        if (!record) {

            return json(res, 400, {
                error: "El enlace ha caducado."
            });

        }

        const passwordHash =
            await hashPassword(newPassword);

        db.exec("BEGIN IMMEDIATE");

        try {

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

        clearSessionCookie(res);

        return json(res, 200, {
            ok: true
        });

    }


    // ======================================
    // MOVIMIENTOS - CONSULTAR
    // NUEVO EN V0.7
    // ======================================

    if (
        pathname === "/api/movements" &&
        req.method === "GET"
    ) {

        const user = getSession(req);

        if (!user) {

            return json(res, 401, {
                error: "Sesión no iniciada."
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


    // ======================================
    // MOVIMIENTOS - CREAR
    // NUEVO EN V0.7
    // ======================================

    if (
        pathname === "/api/movements" &&
        req.method === "POST"
    ) {

        const user = getSession(req);

        if (!user) {

            return json(res, 401, {
                error: "Sesión no iniciada."
            });

        }

        if (limited(req, "movements-create", 100)) {

            return json(res, 429, {
                error: "Demasiadas solicitudes."
            });

        }

        const body = await readBody(req);

        const type = body.type;

        const description =
            typeof body.description === "string"
                ? body.description.trim()
                : "";

        const category = body.category;

        const amount = body.amount_kopeks;

        const validTypes = [
            "income",
            "expense"
        ];

        const validCategories = [
            "food",
            "transport",
            "housing",
            "study",
            "salary",
            "other"
        ];

        if (
            !validTypes.includes(type) ||
            description.length < 1 ||
            description.length > 100 ||
            !validCategories.includes(category) ||
            !Number.isSafeInteger(amount) ||
            amount < 1 ||
            amount > 99999999999
        ) {

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
            INSERT INTO movements (
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
            type,
            description,
            category,
            amount,
            Date.now()
        );

        return json(res, 201, {

            ok: true,

            id: Number(result.lastInsertRowid)

        });

    }


    // ======================================
    // MOVIMIENTOS - ELIMINAR
    // NUEVO EN V0.7
    // ======================================

    const deleteMatch = pathname.match(
        /^\/api\/movements\/([1-9][0-9]*)$/
    );

    if (
        deleteMatch &&
        req.method === "DELETE"
    ) {

        const user = getSession(req);

        if (!user) {

            return json(res, 401, {
                error: "Sesión no iniciada."
            });

        }

        if (limited(req, "movements-delete", 100)) {

            return json(res, 429, {
                error: "Demasiadas solicitudes."
            });

        }

        const movementId =
            Number(deleteMatch[1]);

        if (!Number.isSafeInteger(movementId)) {

            return json(res, 400, {
                error: "Identificador inválido."
            });

        }

        const result = db.prepare(`
            DELETE FROM movements

            WHERE id = ?
              AND user_id = ?
        `).run(
            movementId,
            user.id
        );

        if (result.changes === 0) {

            return json(res, 404, {
                error: "Movimiento no encontrado."
            });

        }

        return json(res, 200, {
            ok: true
        });

    }


    // ======================================
    // RUTA DESCONOCIDA
    // ======================================

    return json(res, 404, {

        error: "Ruta de API no encontrada."

    });

}


// ==========================================
// 14. INICIAR SERVIDOR
// ==========================================

let dummyHash = null;

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


                // =========================
                // PETICIONES API
                // =========================

                if (pathname.startsWith("/api/")) {

                    // Verificar origen en operaciones
                    // que modifican información.

                    if (
                        req.method === "POST" ||
                        req.method === "DELETE"
                    ) {

                        const origin =
                            req.headers.origin;

                        if (origin !== ORIGIN) {

                            return json(res, 403, {
                                error: "Origen no permitido."
                            });

                        }

                    }


                    // Solicitudes POST deben
                    // enviar contenido JSON.

                    if (req.method === "POST") {

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

                    return await api(
                        req,
                        res,
                        pathname
                    );

                }


                // =========================
                // ARCHIVOS WEB
                // =========================

                if (req.method !== "GET") {

                    return json(res, 405, {
                        error: "Método no permitido."
                    });

                }

                serveFile(
                    req,
                    res,
                    pathname
                );

            } catch (error) {

                console.error(
                    "Error:",
                    error.message
                );

                if (!res.headersSent) {

                    json(res, 500, {
                        error: "Error interno del servidor."
                    });

                } else {

                    res.end();

                }

            }

        }
    );


    server.listen(
        PORT,
        HOST,
        () => {

            console.log(
                "\n================================"
            );

            console.log(
                " FALCONI-GIT v0.7"
            );

            console.log(
                " Servidor iniciado correctamente"
            );

            console.log(
                ` ${ORIGIN}`
            );

            console.log(
                "================================\n"
            );

        }
    );

}

start().catch(console.error);