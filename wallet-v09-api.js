"use strict";

const THEMES = [
    "variant-1",
    "variant-2",
    "variant-3"
];

const CATEGORIES = [
    "total",
    "food",
    "transport",
    "housing",
    "study",
    "other"
];

function install(db) {

    db.exec(`
        CREATE TABLE IF NOT EXISTS wallet_cards_v09 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            last4 TEXT NOT NULL,
            holder TEXT NOT NULL,
            variant TEXT NOT NULL,
            created_at INTEGER NOT NULL,

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_wallet_cards_owner
            ON wallet_cards_v09(user_id);

        CREATE TABLE IF NOT EXISTS wallet_links_v09 (
            movement_id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            card_id INTEGER NOT NULL,

            FOREIGN KEY(movement_id)
                REFERENCES movements(id)
                ON DELETE CASCADE,

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE,

            FOREIGN KEY(card_id)
                REFERENCES wallet_cards_v09(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS wallet_budgets_v09 (
            user_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            category TEXT NOT NULL,
            limit_kopeks INTEGER NOT NULL,

            PRIMARY KEY(user_id, month, category),

            FOREIGN KEY(user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );
    `);
}

function validId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function validAmount(value) {
    return (
        Number.isSafeInteger(value) &&
        value >= 1 &&
        value <= 99999999999
    );
}

function validMonth(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ) {
        return false;
    }

    const year = Number(value.slice(0, 4));

    return year >= 2020 && year <= 2100;
}

async function handle(req, res, pathname, helpers) {

    if (!pathname.startsWith("/api/wallet/")) {
        return false;
    }

    const {
        db,
        getSession,
        sendJSON,
        readJSON,
        limited
    } = helpers;

    function reply(status, data) {
        sendJSON(res, status, data);
        return true;
    }

    const user = getSession(req);

    if (!user) {
        return reply(401, {
            error: "Inicia sesión."
        });
    }

    const userId = user.id;
    const method = req.method;

    if (
        ["POST", "PATCH", "DELETE"].includes(method) &&
        limited(req, "wallet-v09", 120)
    ) {
        return reply(429, {
            error: "Demasiadas solicitudes."
        });
    }

    // =====================================
    // CONSULTAR Y CREAR TARJETAS
    // =====================================

    if (pathname === "/api/wallet/cards") {

        if (method === "GET") {

            const cards = db.prepare(`
                SELECT
                    id,
                    alias,
                    last4,
                    holder,
                    variant,
                    created_at
                FROM wallet_cards_v09
                WHERE user_id = ?
                ORDER BY id DESC
            `).all(userId);

            return reply(200, { cards });
        }

        if (method === "POST") {

            const body = await readJSON(req);

            const alias =
                typeof body.alias === "string"
                    ? body.alias.trim()
                    : "";

            const holder =
                typeof body.holder === "string"
                    ? body.holder.trim()
                    : "";

            if (
                alias.length < 2 ||
                alias.length > 30 ||
                holder.length < 1 ||
                holder.length > 24 ||
                typeof body.last4 !== "string" ||
                !/^\d{4}$/.test(body.last4) ||
                !THEMES.includes(body.variant)
            ) {
                return reply(400, {
                    error: "Datos de tarjeta inválidos."
                });
            }

            const count = db.prepare(`
                SELECT COUNT(*) AS total
                FROM wallet_cards_v09
                WHERE user_id = ?
            `).get(userId);

            if (count.total >= 500) {
                return reply(409, {
                    error: "Límite de tarjetas alcanzado."
                });
            }

            const result = db.prepare(`
                INSERT INTO wallet_cards_v09(
                    user_id,
                    alias,
                    last4,
                    holder,
                    variant,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                userId,
                alias,
                body.last4,
                holder,
                body.variant,
                Date.now()
            );

            return reply(201, {
                ok: true,
                id: Number(result.lastInsertRowid)
            });
        }
    }

    // =====================================
    // ELIMINAR TARJETA
    // =====================================

    const cardMatch = pathname.match(
        /^\/api\/wallet\/cards\/([1-9]\d*)$/
    );

    if (cardMatch && method === "DELETE") {

        const cardId = Number(cardMatch[1]);

        if (!validId(cardId)) {
            return reply(400, {
                error: "Identificador inválido."
            });
        }

        const result = db.prepare(`
            DELETE FROM wallet_cards_v09
            WHERE id = ?
              AND user_id = ?
        `).run(cardId, userId);

        if (!result.changes) {
            return reply(404, {
                error: "Tarjeta no encontrada."
            });
        }

        return reply(200, { ok: true });
    }

    // =====================================
    // TARJETAS ASIGNADAS A MOVIMIENTOS
    // =====================================

    if (pathname === "/api/wallet/links") {

        if (method === "GET") {

            const links = db.prepare(`
                SELECT movement_id, card_id
                FROM wallet_links_v09
                WHERE user_id = ?
            `).all(userId);

            return reply(200, { links });
        }

        if (method === "POST") {

            const body = await readJSON(req);

            if (
                !validId(body.movement_id) ||
                (
                    body.card_id !== null &&
                    !validId(body.card_id)
                )
            ) {
                return reply(400, {
                    error: "Identificadores inválidos."
                });
            }

            const movement = db.prepare(`
                SELECT id, type
                FROM movements
                WHERE id = ?
                  AND user_id = ?
            `).get(body.movement_id, userId);

            if (
                !movement ||
                movement.type !== "expense"
            ) {
                return reply(404, {
                    error: "Gasto no encontrado."
                });
            }

            // Quitar tarjeta sin borrar gasto.
            if (body.card_id === null) {

                db.prepare(`
                    DELETE FROM wallet_links_v09
                    WHERE movement_id = ?
                      AND user_id = ?
                `).run(
                    body.movement_id,
                    userId
                );

                return reply(200, { ok: true });
            }

            const card = db.prepare(`
                SELECT id
                FROM wallet_cards_v09
                WHERE id = ?
                  AND user_id = ?
            `).get(
                body.card_id,
                userId
            );

            if (!card) {
                return reply(404, {
                    error: "Tarjeta no encontrada en tu cuenta."
                });
            }

            db.prepare(`
                INSERT INTO wallet_links_v09(
                    movement_id,
                    user_id,
                    card_id
                )
                VALUES (?, ?, ?)

                ON CONFLICT(movement_id)
                DO UPDATE SET
                    card_id = excluded.card_id,
                    user_id = excluded.user_id
            `).run(
                body.movement_id,
                userId,
                body.card_id
            );

            return reply(200, { ok: true });
        }
    }

    // =====================================
    // PRESUPUESTOS MENSUALES
    // =====================================

    if (pathname === "/api/wallet/budgets") {

        if (method === "GET") {

            const url = new URL(
                req.url,
                "http://127.0.0.1"
            );

            const month = url.searchParams.get("month");

            if (!validMonth(month)) {
                return reply(400, {
                    error: "Mes inválido."
                });
            }

            const budgets = db.prepare(`
                SELECT
                    month,
                    category,
                    limit_kopeks
                FROM wallet_budgets_v09
                WHERE user_id = ?
                  AND month = ?
                ORDER BY category
            `).all(userId, month);

            return reply(200, { budgets });
        }

        if (method === "POST") {

            const body = await readJSON(req);

            if (
                !validMonth(body.month) ||
                !CATEGORIES.includes(body.category) ||
                !validAmount(body.limit_kopeks)
            ) {
                return reply(400, {
                    error: "Presupuesto inválido."
                });
            }

            db.prepare(`
                INSERT INTO wallet_budgets_v09(
                    user_id,
                    month,
                    category,
                    limit_kopeks
                )
                VALUES (?, ?, ?, ?)

                ON CONFLICT(user_id, month, category)
                DO UPDATE SET
                    limit_kopeks = excluded.limit_kopeks
            `).run(
                userId,
                body.month,
                body.category,
                body.limit_kopeks
            );

            return reply(200, { ok: true });
        }
    }

    const budgetMatch = pathname.match(
        /^\/api\/wallet\/budgets\/(total|food|transport|housing|study|other)$/
    );

    if (
        budgetMatch &&
        method === "DELETE"
    ) {

        const url = new URL(
            req.url,
            "http://127.0.0.1"
        );

        const month = url.searchParams.get("month");

        if (!validMonth(month)) {
            return reply(400, {
                error: "Mes inválido."
            });
        }

        db.prepare(`
            DELETE FROM wallet_budgets_v09
            WHERE user_id = ?
              AND month = ?
              AND category = ?
        `).run(
            userId,
            month,
            budgetMatch[1]
        );

        return reply(200, { ok: true });
    }

    return reply(405, {
        error: "Método no permitido."
    });
}

module.exports = {
    install,
    handle
};