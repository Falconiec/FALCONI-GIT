"use strict";

/*
 FALCONI-GIT Smart Receipt v0.9.1
 Correccion de seleccion de tarjeta e impresion.
*/

(() => {
    if (window.__FALCONI_SMART_RECEIPT__) return;
    window.__FALCONI_SMART_RECEIPT__ = true;

    const $ = id => document.getElementById(id);

    const THEMES = [
        ["variant-1", "Azul Original"],
        ["variant-2", "Negro Titanio"],
        ["variant-3", "Verde Esmeralda"]
    ];

    const CATEGORIES = [
        ["food", "Alimentación"],
        ["transport", "Transporte"],
        ["housing", "Vivienda"],
        ["study", "Estudios"],
        ["other", "Otros"]
    ];

    const state = {
        cards: [],
        selected: "",
        receipt: null,
        busy: false
    };

    function esc(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            x => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[x]
        );
    }

    function money(value) {
        return new Intl.NumberFormat("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value / 100) + " ₽";
    }

    function kopeks(value) {
        const raw = String(value ?? "").trim();

        if (!/^\d{1,9}([.,]\d{1,2})?$/.test(raw)) {
            return null;
        }

        const [whole, fraction = ""] =
            raw.replace(",", ".").split(".");

        const n =
            Number(whole) * 100 +
            Number(fraction.padEnd(2, "0"));

        return Number.isSafeInteger(n) &&
               n > 0 &&
               n <= 99999999999
            ? n
            : null;
    }

    async function api(url, method = "GET", body) {
        const response = await fetch(url, {
            method,
            credentials: "same-origin",
            headers: body
                ? { "Content-Type": "application/json" }
                : {},
            body: body
                ? JSON.stringify(body)
                : undefined
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Error de servidor."
            );
        }

        return result;
    }

    function chosenCard() {
        return state.cards.find(
            c => String(c.id) === state.selected
        ) || null;
    }

    function cardHTML(card) {
        if (!card) {
            return `
                <div class="sr-empty-card">
                    <strong>F.</strong>
                    <span>
                        Selecciona una de tus tarjetas
                    </span>
                </div>
            `;
        }

        const theme = THEMES.some(
            t => t[0] === card.variant
        ) ? card.variant : "variant-1";

        const last4 = /^[0-9]{4}$/.test(
            String(card.last4)
        ) ? card.last4 : "••••";

        return `
            <div class="fg-card-scene fg-cardskin
                        fg-cardskin--${theme}">
                <div class="fg-premium-card">
                    <div class="fg-card-metal"></div>
                    <div class="fg-card-shine"></div>
                    <div class="fg-card-content">
                        <div class="fg-card-top">
                            <div class="fg-card-chip"></div>
                            <div class="fg-card-brand">
                                <span class="fg-card-brand-symbol">
                                    F.
                                </span>
                                <span class="fg-card-brand-name">
                                    FALCONI
                                </span>
                            </div>
                        </div>

                        <div class="fg-card-number">
                            •••• •••• •••• ${last4}
                        </div>

                        <div class="fg-card-expiry">
                            <span class="fg-card-expiry-label">
                                FALCONI
                            </span>
                            <span class="fg-card-expiry-date">
                                ₽
                            </span>
                        </div>

                        <div class="fg-card-bottom">
                            <span class="fg-card-holder">
                                ${esc(card.holder || "FALCONI-GIT")}
                            </span>
                            <span class="fg-card-corner">
                                F.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function preview() {
        const container = $("sr-card-view");

        container.innerHTML =
            cardHTML(chosenCard());

        container.classList.remove("sr-card-enter");

        void container.offsetWidth;

        container.classList.add("sr-card-enter");
    }

    function receiptHTML(r) {
        const category = CATEGORIES.find(
            c => c[0] === r.category
        )?.[1] || r.category;

        const cardName = r.card
            ? `${r.card.alias} · •••• ${r.card.last4}`
            : "Sin tarjeta";

        const date = new Date(r.date)
            .toLocaleString("es-ES");

        return `
            <div class="sr-receipt-content">
                <div class="sr-receipt-logo">F.</div>

                <strong class="sr-receipt-title">
                    FALCONI-GIT
                </strong>

                <small>COMPROBANTE DE REGISTRO</small>

                <div class="sr-dashes"></div>

                <div class="sr-receipt-line">
                    <span>Fecha</span>
                    <strong>${esc(date)}</strong>
                </div>

                <div class="sr-receipt-line">
                    <span>Concepto</span>
                    <strong>${esc(r.description)}</strong>
                </div>

                <div class="sr-receipt-line">
                    <span>Categoría</span>
                    <strong>${esc(category)}</strong>
                </div>

                <div class="sr-receipt-line">
                    <span>Tarjeta</span>
                    <strong>${esc(cardName)}</strong>
                </div>

                <div class="sr-dashes"></div>

                <div class="sr-receipt-total">
                    <span>GASTO REGISTRADO</span>
                    <strong>${money(r.amount_kopeks)}</strong>
                </div>

                <div class="sr-dashes"></div>

                <small>
                    ${r.id
                        ? `Movimiento #${r.id}`
                        : "ID no disponible"}
                </small>

                <p class="sr-receipt-disclaimer">
                    Registro personal de FALCONI-GIT.
                    No es un comprobante bancario.
                </p>
            </div>
        `;
    }

    function setStatus(message) {
        $("sr-status").textContent = message;
    }

    function reset() {
        state.receipt = null;

        $("sr-form").reset();
        $("sr-card").value = "";
        state.selected = "";

        $("sr-paper").innerHTML = "";
        $("sr-paper").classList.remove("sr-printing");

        $("sr-printer-stage").classList.remove(
            "sr-success"
        );

        $("sr-process-label").textContent =
            "Preparado";

        $("sr-print").disabled = true;
        $("sr-new").disabled = true;
        $("sr-submit").disabled = false;
        $("sr-submit").textContent = "Registrar gasto";

        setStatus("");
        preview();
    }

    async function open() {
        $("sr-overlay").hidden = false;
        document.body.classList.add("sr-modal-open");

        if (state.busy) return;

        setStatus("Cargando tarjetas...");

        try {
            const result = await api(
                "/api/wallet/cards"
            );

            state.cards = Array.isArray(result.cards)
                ? result.cards
                : [];

            const select = $("sr-card");

            select.innerHTML = `
                <option value="">
                    Sin tarjeta
                </option>
                ${state.cards.map(c => `
                    <option value="${Number(c.id)}">
                        ${esc(c.alias)}
                        · •••• ${esc(c.last4)}
                    </option>
                `).join("")}
            `;

            select.value = state.selected;

            if (select.value !== state.selected) {
                state.selected = "";
                select.value = "";
            }

            preview();
            setStatus("");

            if (!state.receipt) {
                $("sr-submit").disabled = false;
            }

        } catch (error) {
            setStatus(
                "No se cargaron las tarjetas: " +
                error.message
            );
            $("sr-submit").disabled = true;
        }
    }

    function close() {
        if (state.busy) return;

        $("sr-overlay").hidden = true;

        document.body.classList.remove(
            "sr-modal-open"
        );
    }

    async function submit(event) {
        event.preventDefault();

        if (state.busy || state.receipt) return;

        const form = new FormData(event.currentTarget);

        const description = String(
            form.get("description") || ""
        ).trim();

        const amount = kopeks(form.get("amount"));

        const category = String(
            form.get("category") || ""
        );

        const card = chosenCard();

        if (
            !description ||
            description.length > 100 ||
            amount === null ||
            !CATEGORIES.some(c => c[0] === category)
        ) {
            setStatus("Revisa los datos del gasto.");
            return;
        }

        state.busy = true;

        $("sr-submit").disabled = true;
        $("sr-submit").textContent = "Guardando...";

        $("sr-process-label").textContent =
            "Guardando en SQLite";

        setStatus("");

        try {
            const result = await api(
                "/api/movements",
                "POST",
                {
                    type: "expense",
                    description,
                    category,
                    amount_kopeks: amount
                }
            );

            const idValue =
                result.id ??
                result.movement_id ??
                result.movement?.id ??
                result.data?.id;

            const id = Number(idValue);

            const validId =
                Number.isSafeInteger(id) && id > 0;

            let linkedCard = null;
            let warning = "";

            if (card && validId) {
                try {
                    await api(
                        "/api/wallet/links",
                        "POST",
                        {
                            movement_id: id,
                            card_id: Number(card.id)
                        }
                    );

                    linkedCard = card;
                } catch (error) {
                    warning =
                        "El gasto se guardó, pero no " +
                        "se pudo vincular la tarjeta: " +
                        error.message;
                }
            } else if (card) {
                warning =
                    "El servidor no devolvió un ID " +
                    "válido para vincular la tarjeta.";
            }

            state.receipt = {
                id: validId ? id : null,
                description,
                category,
                amount_kopeks: amount,
                card: linkedCard,
                date: new Date().toISOString()
            };

            $("sr-paper").innerHTML =
                receiptHTML(state.receipt);

            $("sr-printer-stage").classList.add(
                "sr-success"
            );

            const paper = $("sr-paper");

            paper.classList.remove("sr-printing");

            void paper.offsetWidth;

            paper.classList.add("sr-printing");

            $("sr-process-label").textContent =
                "Gasto registrado";

            $("sr-print").disabled = false;
            $("sr-new").disabled = false;

            setStatus(
                warning ||
                "Gasto guardado. Recibo disponible."
            );

        } catch (error) {
            $("sr-process-label").textContent =
                "Registro no confirmado";

            setStatus(
                "No se pudo confirmar el registro: " +
                error.message
            );

            $("sr-submit").disabled = false;
        } finally {
            state.busy = false;

            $("sr-submit").textContent =
                "Registrar gasto";
        }
    }

    // ==========================================
    // IMPRESION EN DOCUMENTO INDEPENDIENTE
    // ==========================================

    function printReceipt() {
        if (!state.receipt) return;

        const receipt = receiptHTML(state.receipt);

        const frame = document.createElement("iframe");

        frame.setAttribute(
            "title",
            "Impresión del comprobante FALCONI"
        );

        frame.style.cssText = [
            "position:fixed",
            "right:0",
            "bottom:0",
            "width:1px",
            "height:1px",
            "border:0",
            "opacity:0",
            "pointer-events:none"
        ].join(";");

        document.body.append(frame);

        const doc = frame.contentDocument;

        doc.open();

        doc.write(`<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Comprobante FALCONI-GIT</title>

            <style>
                @page {
                    size: A4;
                    margin: 12mm;
                }

                * {
                    box-sizing: border-box;
                }

                html, body {
                    padding: 0;
                    margin: 0;
                    background: white;
                    color: #111;
                    font-family: Arial, sans-serif;
                }

                .receipt-sheet {
                    width: 80mm;
                    margin: 12mm auto 0;
                    padding: 7mm 5mm;
                    border: 1px solid #E3E3E3;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }

                .sr-receipt-content {
                    text-align: center;
                    font-family: "Courier New", monospace;
                    font-size: 10px;
                    line-height: 1.45;
                }

                .sr-receipt-logo {
                    font: bold 30px Georgia, serif;
                }

                .sr-receipt-title {
                    display: block;
                    margin: 3px 0 5px;
                    font-size: 14px;
                }

                .sr-dashes {
                    border-top: 1px dashed #777;
                    margin: 13px 0;
                }

                .sr-receipt-line {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 8px 0;
                    text-align: left;
                }

                .sr-receipt-line strong {
                    text-align: right;
                    max-width: 52%;
                    overflow-wrap: anywhere;
                }

                .sr-receipt-total {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    font-weight: bold;
                }

                .sr-receipt-total strong {
                    font-size: 18px;
                }

                .sr-receipt-disclaimer {
                    font-size: 9px;
                    margin: 14px 0 0;
                    line-height: 1.5;
                }

                @media print {
                    .receipt-sheet {
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <main class="receipt-sheet">
                ${receipt}
            </main>
        </body>
        </html>`);

        doc.close();

        let cleaned = false;

        function cleanup() {
            if (cleaned) return;
            cleaned = true;
            frame.remove();
        }

        frame.contentWindow.addEventListener(
            "afterprint",
            cleanup,
            { once: true }
        );

        // Mantener el iframe si el navegador tarda
        // en abrir el diálogo de impresión.
        frame.contentWindow.focus();
        frame.contentWindow.print();

        // Limpieza de seguridad si no se dispara
        // afterprint. No elimina el iframe de inmediato.
        window.setTimeout(cleanup, 60000);
    }

    function initialize() {
        const launcher = document.createElement("button");

        launcher.id = "sr-launcher";
        launcher.type = "button";
        launcher.textContent = "✦ Smart Receipt";

        document.body.append(launcher);

        const overlay = document.createElement("div");

        overlay.id = "sr-overlay";
        overlay.hidden = true;

        overlay.innerHTML = `
            <div class="sr-window"
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby="sr-title">

                <header class="sr-topbar">
                    <div class="sr-logo">
                        <span class="sr-monogram">F.</span>
                        <div>
                            <strong>FALCONI-GIT</strong>
                            <small>SMART RECEIPT · v0.9.1</small>
                        </div>
                    </div>

                    <button id="sr-close"
                            type="button"
                            aria-label="Cerrar">×</button>
                </header>

                <div class="sr-columns">

                    <div class="sr-left">
                        <span class="sr-eyebrow">
                            REGISTRO FINANCIERO
                        </span>

                        <h2 id="sr-title">
                            Registra tu movimiento
                        </h2>

                        <p class="sr-subtitle">
                            Elige una tarjeta y registra
                            tu gasto en FALCONI-GIT.
                        </p>

                        <div id="sr-card-view"
                             class="sr-card-view"></div>

                        <form id="sr-form">

                            <label>
                                Tarjeta
                                <select id="sr-card"
                                        name="card">
                                    <option value="">
                                        Sin tarjeta
                                    </option>
                                </select>
                            </label>

                            <label>
                                Concepto
                                <input name="description"
                                       maxlength="100"
                                       required
                                       placeholder="Ej. Supermercado">
                            </label>

                            <div class="sr-form-row">

                                <label>
                                    Importe en ₽
                                    <input name="amount"
                                           inputmode="decimal"
                                           required
                                           placeholder="850,00">
                                </label>

                                <label>
                                    Categoría
                                    <select name="category">
                                        ${CATEGORIES.map(
                                            ([id, name]) => `
                                                <option value="${id}">
                                                    ${name}
                                                </option>
                                            `
                                        ).join("")}
                                    </select>
                                </label>

                            </div>

                            <button class="sr-primary"
                                    id="sr-submit"
                                    type="submit">
                                Registrar gasto
                            </button>

                            <p class="sr-note">
                                Registro personal.
                                No realiza pagos bancarios.
                            </p>

                            <p id="sr-status"
                               role="status"
                               aria-live="polite"></p>

                        </form>
                    </div>

                    <div class="sr-right">

                        <div class="sr-process-top">
                            <span class="sr-eyebrow">
                                IMPRESORA DIGITAL
                            </span>

                            <span id="sr-process-label"
                                  class="sr-process-label">
                                Preparado
                            </span>
                        </div>

                        <div id="sr-printer-stage"
                             class="sr-printer-stage">

                            <div class="sr-printer">
                                <div class="sr-printer-lid"></div>
                                <div class="sr-printer-brand">
                                    FALCONI
                                </div>
                                <div class="sr-printer-light"></div>
                                <div class="sr-printer-slot"></div>
                            </div>

                            <div id="sr-paper"
                                 class="sr-paper">
                            </div>

                        </div>

                        <div class="sr-actions">
                            <button id="sr-print"
                                    type="button"
                                    disabled>
                                Imprimir / PDF
                            </button>

                            <button id="sr-new"
                                    type="button"
                                    disabled>
                                Nuevo movimiento
                            </button>
                        </div>

                        <p class="sr-security">
                            Solo se muestran los
                            últimos cuatro dígitos.
                        </p>

                    </div>
                </div>
            </div>
        `;

        document.body.append(overlay);

        launcher.addEventListener("click", open);

        $("sr-close").addEventListener("click", close);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) close();
        });

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                !overlay.hidden
            ) {
                close();
            }
        });

        $("sr-card").addEventListener(
            "change",
            event => {
                state.selected = event.target.value;
                preview();
            }
        );

        $("sr-form").addEventListener(
            "submit",
            submit
        );

        $("sr-print").addEventListener(
            "click",
            printReceipt
        );

        $("sr-new").addEventListener(
            "click",
            reset
        );

        preview();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }
})();