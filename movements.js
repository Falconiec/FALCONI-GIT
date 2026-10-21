
/*
 FALCONI-GIT v0.7
 Movimientos financieros
*/

const movementForm = document.getElementById("movementForm");
const movementList = document.getElementById("movementList");
const emptyMovements = document.getElementById("emptyMovements");
const movementStatus = document.getElementById("movementStatus");

const saveButton = document.getElementById("saveMovement");
const logoutButton = document.getElementById("logoutButton");

const avatar = document.getElementById("avatar");

let movements = [];
let messageKey = "";

function money(kopeks) {
    const locales = {
        es: "es-ES",
        en: "en-US",
        ru: "ru-RU"
    };

    return new Intl.NumberFormat(
        locales[currentLanguage] || "es-ES",
        {
            style: "currency",
            currency: "RUB"
        }
    ).format(kopeks / 100);
}

function showMessage(key) {
    messageKey = key;
    movementStatus.textContent = t(key);
}

function updateSummary() {
    let income = 0;
    let expenses = 0;

    for (const movement of movements) {
        if (movement.type === "income") {
            income += movement.amount_kopeks;
        } else {
            expenses += movement.amount_kopeks;
        }
    }

    document.getElementById("totalIncome").textContent =
        money(income);

    document.getElementById("totalExpenses").textContent =
        money(expenses);

    document.getElementById("currentBalance").textContent =
        money(income - expenses);
}

function renderMovements() {
    movementList.replaceChildren();

    emptyMovements.hidden = movements.length > 0;

    for (const movement of movements) {
        const item = document.createElement("article");
        item.className = "movement-item";

        const icon = document.createElement("div");
        icon.className = "movement-icon";
        icon.textContent =
            movement.type === "income" ? "↙" : "↗";

        const info = document.createElement("div");
        info.className = "movement-info";

        const title = document.createElement("strong");
        title.textContent = movement.description;

        const details = document.createElement("small");

        const category = t(
            "category" +
            movement.category.charAt(0).toUpperCase() +
            movement.category.slice(1)
        );

        details.textContent = category;

        info.append(title, details);

        const amount = document.createElement("span");
        amount.className = "movement-amount";
        amount.textContent =
            (movement.type === "income" ? "+" : "−") +
            money(movement.amount_kopeks);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "movement-delete";
        remove.textContent = "×";
        remove.setAttribute(
            "aria-label",
            t("deleteMovement")
        );

        remove.addEventListener("click", function () {
            deleteMovement(movement.id);
        });

        item.append(icon, info, amount, remove);
        movementList.appendChild(item);
    }

    updateSummary();
}

async function checkSession() {
    const response = await fetch("/api/me", {
        credentials: "same-origin"
    });

    if (!response.ok) {
        window.location.replace("./index.html");
        return false;
    }

    const data = await response.json();

    avatar.textContent =
        data.user.username.charAt(0).toUpperCase();

    return true;
}

async function loadMovements() {
    try {
        const response = await fetch("/api/movements", {
            credentials: "same-origin"
        });

        if (response.status === 401) {
            window.location.replace("./index.html");
            return;
        }

        if (!response.ok) {
            throw new Error("LOAD_FAILED");
        }

        const data = await response.json();

        movements = data.movements;
        renderMovements();

    } catch {
        showMessage("movementLoadError");
    }
}

movementForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const type = document.getElementById("type").value;
    const description =
        document.getElementById("description").value.trim();
    const category =
        document.getElementById("category").value;

    const amountField = document.getElementById("amount");
    const numericAmount = Number(amountField.value);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0 ||
        numericAmount > 999999999.99 ||
        Math.abs(
            numericAmount * 100 -
            Math.round(numericAmount * 100)
        ) > 0.00001 ||
        description.length === 0
    ) {
        showMessage("movementInvalid");
        return;
    }

    const amountKopeks = Math.round(numericAmount * 100);

    saveButton.disabled = true;

    try {
        const response = await fetch("/api/movements", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                type,
                description,
                category,
                amount_kopeks: amountKopeks
            })
        });

        if (response.status === 401) {
            window.location.replace("./index.html");
            return;
        }

        if (!response.ok) {
            throw new Error("SAVE_FAILED");
        }

        movementForm.reset();
        showMessage("movementSaved");
        await loadMovements();

    } catch {
        showMessage("movementSaveError");

    } finally {
        saveButton.disabled = false;
    }
});

async function deleteMovement(id) {
    if (!window.confirm(t("confirmDelete"))) {
        return;
    }

    try {
        const response = await fetch(
            `/api/movements/${id}`,
            {
                method: "DELETE",
                credentials: "same-origin"
            }
        );

        if (response.status === 401) {
            window.location.replace("./index.html");
            return;
        }

        if (!response.ok) {
            throw new Error("DELETE_FAILED");
        }

        showMessage("movementDeleted");
        await loadMovements();

    } catch {
        showMessage("movementDeleteError");
    }
}

logoutButton.addEventListener("click", async function () {
    logoutButton.disabled = true;

    try {
        const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error("LOGOUT_FAILED");
        }

        window.location.replace("./index.html");

    } catch {
        logoutButton.disabled = false;
        showMessage("serverError");
    }
});

document.addEventListener("languageChanged", function () {
    renderMovements();

    if (messageKey) {
        movementStatus.textContent = t(messageKey);
    }
});

async function initializeMovements() {
    try {
        const authenticated = await checkSession();

        if (authenticated) {
            await loadMovements();
        }

    } catch {
        showMessage("serverError");
    }
}

initializeMovements();