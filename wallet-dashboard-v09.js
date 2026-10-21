"use strict";

(() => {

    const host = document.querySelector(
        ".dashboard-content .welcome-card"
    );

    if (!host) {
        return;
    }

    const languages = {
        es: {
            title: "Tus tarjetas, en un solo lugar.",
            description:
                "Organiza tus tarjetas por nombre y últimos cuatro dígitos.",
            manage: "Administrar tarjetas",
            empty: "Todavía no has añadido tarjetas.",
            add: "Añadir mi primera tarjeta"
        },

        en: {
            title: "Your cards, all in one place.",
            description:
                "Organize cards by name and last four digits.",
            manage: "Manage cards",
            empty: "You have not added cards yet.",
            add: "Add my first card"
        },

        ru: {
            title: "Все карты в одном месте.",
            description:
                "Управляйте картами по названию и последним четырём цифрам.",
            manage: "Управлять картами",
            empty: "У вас пока нет добавленных карт.",
            add: "Добавить первую карту"
        }
    };

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

    function language() {
        const code = (
            document.getElementById("language")?.value ||
            document.documentElement.lang ||
            "es"
        ).slice(0, 2);

        return languages[code] || languages.es;
    }

    let cards = [];

    function cardHTML(card) {

        const theme = [
            "variant-1",
            "variant-2",
            "variant-3"
        ].includes(card.variant)
            ? card.variant
            : "variant-1";

        return `
            <article class="fg-wallet-item">

                <div class="fg-card-scene fg-cardskin fg-cardskin--${theme}">

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
                                •••• •••• •••• ${safe(card.last4)}
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
                                    ${safe(card.holder)}
                                </span>

                                <span class="fg-card-corner">
                                    F.
                                </span>

                            </div>

                        </div>

                    </div>

                </div>

                <div class="fg-wallet-meta">

                    <strong>${safe(card.alias)}</strong>

                    <small>
                        •••• ${safe(card.last4)}
                    </small>

                </div>

            </article>
        `;
    }

    function draw() {

        const text = language();

        host.classList.add("fg-wallet-active");

        const heading = `
            <div class="fg-wallet-heading">

                <div class="fg-wallet-copy">

                    <span class="fg-wallet-eyebrow">
                        FALCONI-GIT · MIS TARJETAS
                    </span>

                    <h2>${text.title}</h2>

                    <p>${text.description}</p>

                </div>

                <a
                    class="fg-wallet-manage"
                    href="./cards.html"
                >
                    ${text.manage} →
                </a>

            </div>
        `;

        const content = cards.length
            ? `
                <div class="fg-wallet-list">
                    ${cards.map(cardHTML).join("")}
                </div>
              `
            : `
                <div class="fg-wallet-empty">

                    <p>${text.empty}</p>

                    <a href="./cards.html">
                        ${text.add} →
                    </a>

                </div>
              `;

        host.innerHTML = heading + content;
    }

    async function refresh() {

        try {

            const response = await fetch(
                "/api/wallet/cards",
                {
                    credentials: "same-origin"
                }
            );

            if (!response.ok) {
                throw new Error(
                    "No se pudieron cargar las tarjetas."
                );
            }

            const result = await response.json();

            cards = result.cards;

            draw();

        } catch (error) {

            host.innerHTML = `
                <p>${safe(error.message)}</p>
            `;
        }
    }

    document.addEventListener(
        "languageChanged",
        () => queueMicrotask(draw)
    );

    document.getElementById(
        "language"
    )?.addEventListener(
        "change",
        () => queueMicrotask(draw)
    );

    window.addEventListener(
        "pageshow",
        refresh
    );

    refresh();

})();