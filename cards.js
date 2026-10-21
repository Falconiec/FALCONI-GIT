"use strict";

(() => {

    const $ = id => document.getElementById(id);

    const form = $("cardForm");
    const preview = $("cardPreview");
    const gallery = $("templatesGallery");
    const list = $("cardsList");
    const status = $("cardStatus");

    if (
        !form ||
        !preview ||
        !gallery ||
        !list ||
        !status
    ) {
        return;
    }

    const alias = $("cardAlias");
    const last4 = $("cardLast4");
    const holder = $("cardHolder");

    const themes = [
        ["variant-1", "Azul Original"],
        ["variant-2", "Negro Titanio"],
        ["variant-3", "Verde Esmeralda"]
    ];

    function safe(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[char]
        );
    }

    function selectedTheme() {
        const radio = document.querySelector(
            'input[name="variant"]:checked'
        );

        const value = radio?.value || "variant-1";

        return themes.some(t => t[0] === value)
            ? value
            : "variant-1";
    }

    async function request(url, method = "GET", data) {

        const response = await fetch(url, {
            method,
            credentials: "same-origin",

            headers: data
                ? {
                    "Content-Type": "application/json"
                }
                : {},

            body: data
                ? JSON.stringify(data)
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

    function cardHTML(card, demo = false) {

        const variant = themes.some(
            t => t[0] === card.variant
        ) ? card.variant : "variant-1";

        const digits = demo
            ? "4874 2479 2847 1204"
            : `•••• •••• •••• ${safe(card.last4 || "••••")}`;

        return `
            <div class="fg-card-scene fg-cardskin fg-cardskin--${variant}">
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
                            ${digits}
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
                                ${safe(card.holder || "FALCONI-GIT")}
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

    let cards = [];

    function renderPreview() {

        preview.innerHTML = cardHTML({
            last4: last4.value.trim(),
            holder: holder.value.trim() || "FALCONI-GIT",
            variant: selectedTheme()
        });
    }

    function renderTemplates() {

        gallery.innerHTML = themes.map(
            ([variant, name]) => `
                <article class="saved-card-item">

                    ${cardHTML({
                        last4: "1204",
                        holder: "FALCONI-GIT",
                        variant
                    }, true)}

                    <div class="saved-card-meta">

                        <strong>${safe(name)}</strong>

                        <button
                            type="button"
                            class="fg-theme-button"
                            data-theme="${variant}"
                        >
                            Elegir
                        </button>

                    </div>
                </article>
            `
        ).join("");
    }

    function renderSaved() {

        if (!cards.length) {

            list.innerHTML = `
                <p class="saved-empty">
                    Todavía no tienes tarjetas en tu cuenta.
                </p>
            `;

            return;
        }

        list.innerHTML = cards.map(card => `
            <article class="saved-card-item">

                ${cardHTML(card)}

                <div class="saved-card-meta">

                    <div class="saved-card-text">

                        <strong>${safe(card.alias)}</strong>

                        <span>
                            •••• ${safe(card.last4)}
                        </span>

                    </div>

                    <button
                        type="button"
                        class="delete-card-button"
                        data-card-id="${card.id}"
                    >
                        Eliminar
                    </button>

                </div>

            </article>
        `).join("");
    }

    async function refresh() {

        const result = await request(
            "/api/wallet/cards"
        );

        cards = result.cards;

        renderSaved();
    }

    gallery.addEventListener("click", event => {

        const button = event.target.closest(
            "button[data-theme]"
        );

        if (!button) {
            return;
        }

        const radio = document.querySelector(
            `input[name="variant"][value="${button.dataset.theme}"]`
        );

        if (radio) {
            radio.checked = true;
            renderPreview();
        }
    });

    last4.addEventListener("input", () => {

        last4.value = last4.value
            .replace(/\D/g, "")
            .slice(0, 4);

        renderPreview();
    });

    [alias, holder].forEach(input => {
        input.addEventListener(
            "input",
            renderPreview
        );
    });

    document.querySelectorAll(
        'input[name="variant"]'
    ).forEach(radio => {

        radio.addEventListener(
            "change",
            renderPreview
        );
    });

    form.addEventListener("submit", async event => {

        event.preventDefault();

        try {

            await request(
                "/api/wallet/cards",
                "POST",
                {
                    alias: alias.value.trim(),
                    last4: last4.value.trim(),
                    holder: holder.value.trim(),
                    variant: selectedTheme()
                }
            );

            form.reset();

            holder.value = "FALCONI-GIT";

            renderPreview();

            await refresh();

            status.textContent =
                "Tarjeta guardada en SQLite.";

        } catch (error) {

            status.textContent = error.message;
        }
    });

    list.addEventListener("click", async event => {

        const button = event.target.closest(
            "button[data-card-id]"
        );

        if (!button) {
            return;
        }

        if (!confirm(
            "¿Eliminar esta tarjeta? Los movimientos se conservarán."
        )) {
            return;
        }

        try {

            await request(
                `/api/wallet/cards/${Number(button.dataset.cardId)}`,
                "DELETE"
            );

            await refresh();

            status.textContent =
                "Tarjeta eliminada.";

        } catch (error) {

            status.textContent = error.message;
        }
    });

    // =====================================
    // IMPORTACION VOLUNTARIA
    // =====================================

    const migration = document.createElement(
        "button"
    );

    migration.type = "button";
    migration.className = "fg-theme-button";

    migration.textContent =
        "Importar tarjetas antiguas del navegador";

    migration.style.marginTop = "12px";

    list.parentElement.append(migration);

    migration.addEventListener("click", async () => {

        let oldCards = [];

        try {
            oldCards = JSON.parse(
                localStorage.getItem(
                    "falconi_git_cards_v1"
                ) || "[]"
            );
        } catch {
            oldCards = [];
        }

        if (
            !Array.isArray(oldCards) ||
            !oldCards.length
        ) {
            status.textContent =
                "No hay tarjetas antiguas.";
            return;
        }

        if (!confirm(
            "Estas tarjetas estaban guardadas en este navegador. ¿Confirmas que son tuyas y deseas importarlas?"
        )) {
            return;
        }

        let imported = 0;

        try {

            for (const card of oldCards) {

                if (
                    !card ||
                    typeof card.alias !== "string" ||
                    !/^\d{4}$/.test(card.last4) ||
                    !themes.some(t => t[0] === card.variant)
                ) {
                    continue;
                }

                if (cards.some(current =>
                    current.alias === card.alias &&
                    current.last4 === card.last4 &&
                    current.variant === card.variant
                )) {
                    continue;
                }

                await request(
                    "/api/wallet/cards",
                    "POST",
                    {
                        alias: card.alias.slice(0, 30),
                        last4: card.last4,
                        holder: String(
                            card.holder || "FALCONI-GIT"
                        ).slice(0, 24),
                        variant: card.variant
                    }
                );

                imported++;
            }

            await refresh();

            status.textContent =
                `Importadas ${imported} tarjetas.`;

        } catch (error) {

            await refresh();

            status.textContent =
                `Importación parcial: ${error.message}`;
        }
    });

    renderTemplates();
    renderPreview();

    refresh().catch(error => {
        list.textContent =
            "No se pudieron cargar las tarjetas: " +
            error.message;
    });

})();