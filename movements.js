
/*
========================================
 FALCONI-GIT v0.8
 Gestión de movimientos financieros
========================================
*/

"use strict";

// ELEMENTOS HTML
const $ = id => document.getElementById(id);

const form = $("movementForm");
const list = $("movementList");
const status = $("movementStatus");
const submitButton = $("saveMovement");

let movements = [];
let editingId = null;
let lastMessage = "";

// ========================================
// IDIOMA Y FORMATO
// ========================================

function getLanguage() {
    if (typeof currentLanguage !== "undefined") {
        return currentLanguage;
    }

    return "es";
}

function money(kopeks) {
    const locales = {
        es: "es-ES",
        en: "en-US",
        ru: "ru-RU"
    };

    return new Intl.NumberFormat(
        locales[getLanguage()] || "es-ES",
        {
            style: "currency",
            currency: "RUB"
        }
    ).format(kopeks / 100);
}

function showMessage(key) {
    lastMessage = key;
    status.textContent = t(key);
}

function categoryLabel(category) {
    const key =
        "category" +
        category.charAt(0).toUpperCase() +
        category.slice(1);

    return t(key);
}

function formatDate(timestamp) {
    const locales = {
        es: "es-ES",
        en: "en-US",
        ru: "ru-RU"
    };

    return new Intl.DateTimeFormat(
        locales[getLanguage()] || "es-ES",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(new Date(timestamp));
}

// ========================================
// TOTALES FINANCIEROS
// ========================================

function calculateTotals(items) {
    let income = 0;
    let expenses = 0;

    for (const item of items) {
        if (item.type === "income") {
            income += item.amount_kopeks;
        } else {
            expenses += item.amount_kopeks;
        }
    }

    return { income, expenses };
}

function renderSummary() {
    const { income, expenses } =
        calculateTotals(movements);

    $("totalIncome").textContent = money(income);
    $("totalExpenses").textContent = money(expenses);

    $("currentBalance").textContent =
        money(income - expenses);

    const maximum = Math.max(income, expenses, 1);

    $("incomeBar").style.height =
        `${(income / maximum) * 100}%`;

    $("expenseBar").style.height =
        `${(expenses / maximum) * 100}%`;

    $("incomeChartValue").textContent =
        money(income);

    $("expenseChartValue").textContent =
        money(expenses);

    $("financialChart").setAttribute(
        "aria-label",
        `${t("totalIncome")}: ${money(income)}. ` +
        `${t("totalExpenses")}: ${money(expenses)}.`
    );
}

// ========================================
// FECHAS Y FILTROS
// ========================================

function localDate(timestamp) {
    const date = new Date(timestamp);

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function filteredMovements() {
    const search =
        $("searchInput").value
            .trim()
            .toLocaleLowerCase();

    const type = $("filterType").value;
    const category = $("filterCategory").value;
    const start = $("startDate").value;
    const end = $("endDate").value;

    return movements.filter(item => {
        const matchesSearch =
            item.description
                .toLocaleLowerCase()
                .includes(search);

        const matchesType =
            type === "all" || item.type === type;

        const matchesCategory =
            category === "all" ||
            item.category === category;

        const date = localDate(item.created_at);

        const matchesStart =
            !start || date >= start;

        const matchesEnd =
            !end || date <= end;

        return (
            matchesSearch &&
            matchesType &&
            matchesCategory &&
            matchesStart &&
            matchesEnd
        );
    });
}

// ========================================
// CREAR BOTONES
// ========================================

function makeButton(label, className, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.className = className;

    button.addEventListener("click", callback);

    return button;
}

// ========================================
// MOSTRAR HISTORIAL
// ========================================

function renderList() {
    const filtered = filteredMovements();

    list.replaceChildren();

    $("resultCount").textContent =
        String(filtered.length);

    const empty = $("emptyMovements");

    empty.hidden = filtered.length > 0;

    if (filtered.length === 0) {
        empty.textContent = movements.length === 0
            ? t("emptyMovements")
            : t("noFilterResults");
    }

    for (const item of filtered) {
        const row = document.createElement("article");
        row.className = "movement-item";

        const icon = document.createElement("div");
        icon.className = "movement-icon";

        icon.textContent =
            item.type === "income" ? "↙" : "↗";

        const info = document.createElement("div");
        info.className = "movement-info";

        const title = document.createElement("strong");
        title.textContent = item.description;

        const details = document.createElement("small");

        details.textContent =
            `${categoryLabel(item.category)} · ` +
            formatDate(item.created_at);

        info.append(title, details);

        const amount = document.createElement("span");

        amount.className =
            `movement-amount ${item.type}`;

        amount.textContent =
            (item.type === "income" ? "+" : "−") +
            money(item.amount_kopeks);

        const actions = document.createElement("div");
        actions.className = "movement-actions";

        const editButton = makeButton(
            t("editMovement"),
            "edit-button",
            () => beginEdit(item)
        );

        const deleteButton = makeButton(
            t("deleteMovement"),
            "delete-button",
            () => deleteMovement(item.id)
        );

        actions.append(editButton, deleteButton);

        row.append(
            icon,
            info,
            amount,
            actions
        );

        list.append(row);
    }
}

// ========================================
// ACTUALIZAR INTERFAZ
// ========================================

function render() {
    renderSummary();
    renderList();
}

// ========================================
// EDICIÓN DE MOVIMIENTOS
// ========================================

function resetEditor() {
    editingId = null;

    form.reset();

    $("cancelEdit").hidden = true;

    $("formTitle").textContent =
        t("newMovement");

    $("saveButtonText").textContent =
        t("saveMovement");
}

function beginEdit(item) {
    editingId = item.id;

    $("type").value = item.type;
    $("description").value = item.description;

    $("amount").value =
        (item.amount_kopeks / 100).toFixed(2);

    $("category").value = item.category;

    $("formTitle").textContent =
        t("editMovement");

    $("saveButtonText").textContent =
        t("updateMovement");

    $("cancelEdit").hidden = false;

    $("editorPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    $("description").focus();
}

// ========================================
// VALIDAR FORMULARIO
// ========================================

function movementPayload() {
    const amount = Number($("amount").value);

    const description =
        $("description").value.trim();

    if (
        description.length === 0 ||
        description.length > 100 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 999999999.99 ||
        Math.abs(
            amount * 100 -
            Math.round(amount * 100)
        ) > 0.00001
    ) {
        throw new Error("INVALID_MOVEMENT");
    }

    return {
        type: $("type").value,
        description,
        category: $("category").value,
        amount_kopeks: Math.round(amount * 100)
    };
}

// ========================================
// PETICIONES AL SERVIDOR
// ========================================

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });

    if (response.status === 401) {
        window.location.replace("./index.html");
        throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
    }

    return response.json();
}

async function loadMovements() {
    const data = await apiRequest("/api/movements");

    movements = data.movements;

    render();
}

// ========================================
// GUARDAR O EDITAR MOVIMIENTO
// ========================================

form.addEventListener("submit", async event => {
    event.preventDefault();

    let payload;

    try {
        payload = movementPayload();
    } catch {
        showMessage("movementInvalid");
        return;
    }

    submitButton.disabled = true;

    try {
        const isEditing = editingId !== null;

        const url = isEditing
            ? `/api/movements/${editingId}`
            : "/api/movements";

        await apiRequest(url, {
            method: isEditing ? "PATCH" : "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        });

        resetEditor();

        await loadMovements();

        showMessage(
            isEditing
                ? "movementUpdated"
                : "movementSaved"
        );

    } catch (error) {
        if (error.message !== "UNAUTHORIZED") {
            showMessage("movementSaveError");
        }

    } finally {
        submitButton.disabled = false;
    }
});

// ========================================
// ELIMINAR MOVIMIENTOS
// ========================================

async function deleteMovement(id) {
    if (!window.confirm(t("confirmDelete"))) {
        return;
    }

    try {
        await apiRequest(
            `/api/movements/${id}`,
            {
                method: "DELETE"
            }
        );

        if (editingId === id) {
            resetEditor();
        }

        await loadMovements();

        showMessage("movementDeleted");

    } catch (error) {
        if (error.message !== "UNAUTHORIZED") {
            showMessage("movementDeleteError");
        }
    }
}

// ========================================
// CANCELAR EDICIÓN
// ========================================

$("cancelEdit").addEventListener(
    "click",
    resetEditor
);

// ========================================
// LIMPIAR FILTROS
// ========================================

$("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("filterType").value = "all";
    $("filterCategory").value = "all";
    $("startDate").value = "";
    $("endDate").value = "";

    renderList();
});

// ========================================
// FILTROS AUTOMÁTICOS
// ========================================

for (const id of [
    "searchInput",
    "filterType",
    "filterCategory",
    "startDate",
    "endDate"
]) {
    $(id).addEventListener("input", renderList);
    $(id).addEventListener("change", renderList);
}

// ========================================
// CERRAR SESIÓN
// ========================================

$("logoutButton").addEventListener(
    "click",
    async () => {
        const button = $("logoutButton");

        button.disabled = true;

        try {
            await apiRequest("/api/logout", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: "{}"
            });

            window.location.replace("./index.html");

        } catch {
            button.disabled = false;
            showMessage("serverError");
        }
    }
);

// ========================================
// CAMBIAR IDIOMA
// ========================================

document.addEventListener(
    "languageChanged",
    () => {
        render();

        if (editingId !== null) {
            $("formTitle").textContent =
                t("editMovement");

            $("saveButtonText").textContent =
                t("updateMovement");
        }

        if (lastMessage) {
            status.textContent = t(lastMessage);
        }
    }
);

// ========================================
// INICIAR MOVIMIENTOS
// ========================================

async function startMovements() {
    try {
        const profile = await apiRequest("/api/me");

        $("avatar").textContent =
            profile.user.username
                .charAt(0)
                .toUpperCase();

        await loadMovements();

    } catch (error) {
        if (error.message !== "UNAUTHORIZED") {
            showMessage("movementLoadError");
        }
    }
}

startMovements();

/*
 FG-RUBLE-VIEW-FIX-081

 Correccion visual:
 mostrar el simbolo del rublo
 sin cambiar importes ni calculos.
*/

(() => {
    "use strict";

    function correctText(node) {

        if (
            node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue.includes("RUB")
        ) {
            return;
        }

        const corrected = node.nodeValue.replace(
            /\bRUB\b/g,
            "₽"
        );

        if (corrected !== node.nodeValue) {
            node.nodeValue = corrected;
        }
    }

    function scan(node) {

        if (node.nodeType === Node.TEXT_NODE) {
            correctText(node);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT
        );

        while (walker.nextNode()) {

            const textNode = walker.currentNode;

            if (
                !textNode.parentElement?.closest(
                    "script,style,textarea"
                )
            ) {
                correctText(textNode);
            }
        }
    }

    function initialize() {

        const area = document.querySelector(
            ".main-column"
        ) || document.body;

        // Corregir importes ya mostrados.
        scan(area);

        // Corregir importes cuando la pagina
        // actualiza movimientos o graficos.
        const observer = new MutationObserver(
            changes => {

                for (const change of changes) {

                    if (change.type === "characterData") {

                        correctText(change.target);

                    } else {

                        for (const node of change.addedNodes) {
                            scan(node);
                        }

                    }
                }
            }
        );

        observer.observe(area, {
            subtree: true,
            childList: true,
            characterData: true
        });
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
