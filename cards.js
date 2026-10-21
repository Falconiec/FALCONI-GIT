const CARD_STORAGE_KEY = "falconi_git_cards_v1";

const cardForm = document.getElementById("cardForm");
const cardAlias = document.getElementById("cardAlias");
const cardLast4 = document.getElementById("cardLast4");
const cardHolder = document.getElementById("cardHolder");
const cardPreview = document.getElementById("cardPreview");
const cardsList = document.getElementById("cardsList");
const templatesGallery = document.getElementById("templatesGallery");
const cardStatus = document.getElementById("cardStatus");

function getCards() {
    try {
        const raw = localStorage.getItem(CARD_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveCards(cards) {
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cards));
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSelectedVariant() {
    const selected = document.querySelector('input[name="variant"]:checked');
    return selected ? selected.value : "variant-1";
}

function createCardMarkup({
    alias = "Principal",
    last4 = "1204",
    holder = "FALCONI-GIT",
    variant = "variant-1"
}) {
    const safeAlias = escapeHtml(alias);
    const safeLast4 = escapeHtml(last4);
    const safeHolder = escapeHtml(holder);

    const carbon = variant === "variant-3"
        ? '<div class="fg-carbon"></div>'
        : '';

    return `
        <div class="fg-card ${variant}">
            <div class="fg-shape s1"></div>
            <div class="fg-shape s2"></div>
            <div class="fg-shape s3"></div>
            ${carbon}

            <div class="fg-brand-top">
                <strong>F.</strong>
                <span>FALCONI</span>
            </div>

            <div class="fg-chip"></div>

            <div class="fg-number">4874 2479 2847 ${safeLast4}</div>

            <div class="fg-valid">
                <small>VALID<br>THRU</small>
                <strong>08/28</strong>
            </div>

            <div class="fg-holder">${safeHolder}</div>
            <div class="fg-brand-bottom">F.</div>
        </div>
    `;
}

function renderPreview() {
    cardPreview.innerHTML = createCardMarkup({
        alias: cardAlias.value.trim() || "Principal",
        last4: cardLast4.value.trim() || "1204",
        holder: cardHolder.value.trim() || "FALCONI-GIT",
        variant: getSelectedVariant()
    });
}

function renderTemplates() {
    const templates = [
        {
            alias: "Variante 1 · Azul Plata",
            last4: "1204",
            holder: "FALCONI-GIT",
            variant: "variant-1"
        },
        {
            alias: "Variante 2 · Negro Titanio",
            last4: "1204",
            holder: "FALCONI-GIT",
            variant: "variant-2"
        },
        {
            alias: "Variante 3 · Azul Carbono",
            last4: "1204",
            holder: "FALCONI-GIT",
            variant: "variant-3"
        }
    ];

    templatesGallery.innerHTML = templates.map(template => `
        <div class="saved-card-item">
            ${createCardMarkup(template)}
            <div class="saved-card-meta">
                <div class="saved-card-text">
                    <strong>${template.alias}</strong>
                    <span>Plantilla disponible</span>
                </div>
            </div>
        </div>
    `).join("");
}

function renderSavedCards() {
    const cards = getCards();

    if (!cards.length) {
        cardsList.innerHTML = `
            <p class="saved-empty">
                Aún no tienes tarjetas guardadas. Añade la primera.
            </p>
        `;
        return;
    }

    cardsList.innerHTML = cards.map(card => `
        <div class="saved-card-item">
            ${createCardMarkup(card)}
            <div class="saved-card-meta">
                <div class="saved-card-text">
                    <strong>${escapeHtml(card.alias)}</strong>
                    <span>Terminada en ${escapeHtml(card.last4)}</span>
                </div>

                <button
                    class="delete-card-button"
                    data-id="${card.id}"
                    type="button"
                >
                    Eliminar
                </button>
            </div>
        </div>
    `).join("");

    document.querySelectorAll(".delete-card-button").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            const cards = getCards().filter(card => card.id !== id);
            saveCards(cards);
            renderSavedCards();
            cardStatus.textContent = "Tarjeta eliminada.";
        });
    });
}

function validateLast4(value) {
    return /^[0-9]{4}$/.test(value);
}

if (cardAlias) {
    ["input", "change"].forEach(eventName => {
        cardAlias.addEventListener(eventName, renderPreview);
        cardLast4.addEventListener(eventName, renderPreview);
        cardHolder.addEventListener(eventName, renderPreview);
    });

    document.querySelectorAll('input[name="variant"]').forEach(input => {
        input.addEventListener("change", renderPreview);
    });

    cardLast4.addEventListener("input", () => {
        cardLast4.value = cardLast4.value.replace(/\D/g, "").slice(0, 4);
        renderPreview();
    });

    cardForm.addEventListener("submit", event => {
        event.preventDefault();

        const alias = cardAlias.value.trim();
        const last4 = cardLast4.value.trim();
        const holder = cardHolder.value.trim() || "FALCONI-GIT";
        const variant = getSelectedVariant();

        if (alias.length < 2) {
            cardStatus.textContent = "El alias debe tener al menos 2 caracteres.";
            return;
        }

        if (!validateLast4(last4)) {
            cardStatus.textContent = "Debes escribir exactamente 4 dígitos.";
            return;
        }

        const cards = getCards();

        cards.unshift({
            id: String(Date.now()),
            alias,
            last4,
            holder,
            variant
        });

        saveCards(cards);
        renderSavedCards();

        cardStatus.textContent = "Tarjeta guardada correctamente.";

        cardAlias.value = "";
        cardLast4.value = "";
        cardHolder.value = "FALCONI-GIT";
        document.querySelector('input[name="variant"][value="variant-1"]').checked = true;

        renderPreview();
    });

    renderPreview();
    renderTemplates();
    renderSavedCards();
}