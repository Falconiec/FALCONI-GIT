"use strict";

(() => {

    const host =
        document.querySelector(".dashboard-content") ||
        document.querySelector("main");

    if (
        !host ||
        document.getElementById("fg-finance-v09")
    ) {
        return;
    }

    const section = document.createElement("section");

    section.id = "fg-finance-v09";
    section.className = "fg-finance-v09";

    host.append(section);

    const categories = {
        total: "Presupuesto general",
        food: "Alimentación",
        transport: "Transporte",
        housing: "Vivienda",
        study: "Estudios",
        other: "Otros",
        salary: "Salario"
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

    function money(kopeks) {
        return new Intl.NumberFormat(
            "es-ES",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(kopeks / 100) + " ₽";
    }

    function amountToKopeks(value) {

        if (
            !/^\d{1,9}([.,]\d{1,2})?$/.test(value)
        ) {
            return null;
        }

        const parts = value
            .replace(",", ".")
            .split(".");

        const whole = Number(parts[0]);

        const cents = Number(
            (parts[1] || "").padEnd(2, "0")
        );

        const result = whole * 100 + cents;

        return Number.isSafeInteger(result) &&
            result > 0 &&
            result <= 99999999999
                ? result
                : null;
    }

    async function request(
        url,
        method = "GET",
        data
    ) {

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

    let movements = [];
    let cards = [];
    let links = [];
    let budgets = [];

    const now = new Date();

    let month =
        `${now.getFullYear()}-` +
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    function belongsToMonth(movement) {

        const date = new Date(
            movement.created_at
        );

        return (
            `${date.getFullYear()}-` +
            String(
                date.getMonth() + 1
            ).padStart(2, "0")
        ) === month;
    }

    async function reload() {

        try {

            const results = await Promise.all([
                request("/api/movements"),
                request("/api/wallet/cards"),
                request("/api/wallet/links"),
                request(
                    `/api/wallet/budgets?month=${month}`
                )
            ]);

            movements = results[0].movements;
            cards = results[1].cards;
            links = results[2].links;
            budgets = results[3].budgets;

            draw();

        } catch (error) {

            section.innerHTML = `
                <div class="fgv09-panel">

                    <h2>Análisis financiero</h2>

                    <p role="alert">
                        ${safe(error.message)}
                    </p>

                    <button
                        type="button"
                        id="fgv09-retry"
                    >
                        Reintentar
                    </button>

                </div>
            `;

            document.getElementById(
                "fgv09-retry"
            ).addEventListener(
                "click",
                reload
            );
        }
    }

    function draw() {

        const current = movements.filter(
            belongsToMonth
        );

        const income = current
            .filter(m => m.type === "income")
            .reduce(
                (sum, m) => sum + m.amount_kopeks,
                0
            );

        const expense = current
            .filter(m => m.type === "expense")
            .reduce(
                (sum, m) => sum + m.amount_kopeks,
                0
            );

        const allIncome = movements
            .filter(m => m.type === "income")
            .reduce(
                (sum, m) => sum + m.amount_kopeks,
                0
            );

        const allExpense = movements
            .filter(m => m.type === "expense")
            .reduce(
                (sum, m) => sum + m.amount_kopeks,
                0
            );

        const balance = allIncome - allExpense;

        const spending = {
            total: 0,
            food: 0,
            transport: 0,
            housing: 0,
            study: 0,
            other: 0
        };

        current
            .filter(m => m.type === "expense")
            .forEach(m => {

                spending.total += m.amount_kopeks;

                if (m.category in spending) {
                    spending[m.category] +=
                        m.amount_kopeks;
                }
            });

        const linked = new Map(
            links.map(link => [
                link.movement_id,
                link.card_id
            ])
        );

        const cardTotals = new Map(
            cards.map(card => [card.id, 0])
        );

        current.forEach(movement => {

            if (
                movement.type !== "expense" ||
                !linked.has(movement.id)
            ) {
                return;
            }

            const cardId = linked.get(
                movement.id
            );

            cardTotals.set(
                cardId,
                (cardTotals.get(cardId) || 0) +
                movement.amount_kopeks
            );
        });

        const max = Math.max(
            income,
            expense,
            1
        );

        const incomeHeight = income
            ? Math.max(
                4,
                Math.round(income / max * 100)
            )
            : 0;

        const expenseHeight = expense
            ? Math.max(
                4,
                Math.round(expense / max * 100)
            )
            : 0;

        const cardOptions = cards.map(
            card => `
                <option value="${card.id}">
                    ${safe(card.alias)}
                    •••• ${safe(card.last4)}
                </option>
            `
        ).join("");

        const budgetRows = budgets.map(
            budget => {

                const spent =
                    spending[budget.category] || 0;

                const percent = Math.round(
                    spent / budget.limit_kopeks * 100
                );

                const color = percent >= 100
                    ? "#B42332"
                    : percent >= 80
                        ? "#C38313"
                        : "#1E3A8A";

                return `
                    <div class="fgv09-budget-row">

                        <div class="fgv09-budget-line">

                            <strong>
                                ${safe(
                                    categories[budget.category] ||
                                    budget.category
                                )}
                            </strong>

                            <span>
                                ${money(spent)}
                                /
                                ${money(budget.limit_kopeks)}
                                · ${percent}%
                            </span>

                            <button
                                type="button"
                                class="fgv09-link"
                                data-delete-budget="${budget.category}"
                            >
                                Eliminar
                            </button>

                        </div>

                        <div class="fgv09-progress">
                            <div
                                style="
                                    width:${Math.min(percent, 100)}%;
                                    background:${color};
                                "
                            ></div>
                        </div>

                        ${
                            percent >= 80
                            ? `<small class="fgv09-warning">
                                ${
                                    percent >= 100
                                        ? "Límite alcanzado o superado"
                                        : "Estás cerca del límite"
                                }
                               </small>`
                            : ""
                        }

                    </div>
                `;
            }
        ).join("");

        const expenseRows = movements
            .filter(m => m.type === "expense")
            .slice(0, 100)
            .map(movement => {

                const options = cards.map(card => `
                    <option
                        value="${card.id}"
                        ${
                            linked.get(movement.id) === card.id
                                ? "selected"
                                : ""
                        }
                    >
                        ${safe(card.alias)}
                        · ${safe(card.last4)}
                    </option>
                `).join("");

                return `
                    <div class="fgv09-assign-row">

                        <div>

                            <strong>
                                ${safe(movement.description)}
                            </strong>

                            <small>
                                ${money(movement.amount_kopeks)}
                            </small>

                        </div>

                        <select
                            data-movement-id="${movement.id}"
                        >

                            <option value="">
                                Sin asignar
                            </option>

                            ${options}

                        </select>

                    </div>
                `;
            }
        ).join("");

        section.innerHTML = `
            <div class="fgv09-heading">

                <div>

                    <span class="fgv09-eyebrow">
                        FALCONI-GIT v0.9
                    </span>

                    <h2>
                        Análisis financiero y presupuestos
                    </h2>

                    <p>
                        Controla tus ingresos, gastos
                        y tarjetas en un solo lugar.
                    </p>

                </div>

                <div class="fgv09-heading-actions">

                    <label for="fgv09-month">
                        Mes
                    </label>

                    <input
                        type="month"
                        id="fgv09-month"
                        value="${month}"
                    >

                    <button
                        type="button"
                        id="fgv09-refresh"
                    >
                        Actualizar
                    </button>

                </div>

            </div>

            <div class="fgv09-stats">

                <article class="fgv09-stat">

                    <span>
                        Ingresos del mes
                    </span>

                    <strong>
                        ${money(income)}
                    </strong>

                </article>

                <article class="fgv09-stat">

                    <span>
                        Gastos del mes
                    </span>

                    <strong>
                        ${money(expense)}
                    </strong>

                </article>

                <article class="fgv09-stat fgv09-stat-main">

                    <span>
                        Balance general registrado
                    </span>

                    <strong>
                        ${money(balance)}
                    </strong>

                </article>

            </div>

            <div class="fgv09-columns">

                <section class="fgv09-panel">

                    <h3>
                        Ingresos frente a gastos
                    </h3>

                    <div class="fgv09-chart">

                        <div class="fgv09-bar-block">

                            <div class="fgv09-bar-track">

                                <div
                                    class="fgv09-bar fgv09-income"
                                    style="height:${incomeHeight}%"
                                ></div>

                            </div>

                            <b>${money(income)}</b>
                            <small>Ingresos</small>

                        </div>

                        <div class="fgv09-bar-block">

                            <div class="fgv09-bar-track">

                                <div
                                    class="fgv09-bar fgv09-expense"
                                    style="height:${expenseHeight}%"
                                ></div>

                            </div>

                            <b>${money(expense)}</b>
                            <small>Gastos</small>

                        </div>

                    </div>

                    <h3>Gastos por categoría</h3>

                    ${
                        ["food", "transport", "housing", "study", "other"]
                        .map(category => `
                            <div class="fgv09-category">

                                <span>
                                    ${categories[category]}
                                </span>

                                <b>
                                    ${money(spending[category])}
                                </b>

                            </div>
                        `).join("")
                    }

                </section>

                <section class="fgv09-panel">

                    <h3>Presupuestos del mes</h3>

                    ${
                        budgetRows ||
                        '<p>Aún no tienes presupuestos.</p>'
                    }

                    <form
                        id="fgv09-budget-form"
                        class="fgv09-form"
                    >

                        <label>
                            Categoría

                            <select name="category">

                                ${
                                    ["total", "food", "transport", "housing", "study", "other"]
                                    .map(category => `
                                        <option value="${category}">
                                            ${categories[category]}
                                        </option>
                                    `).join("")
                                }

                            </select>

                        </label>

                        <label>
                            Límite mensual (₽)

                            <input
                                name="amount"
                                placeholder="15000,00"
                                required
                            >

                        </label>

                        <button type="submit">
                            Guardar presupuesto
                        </button>

                    </form>

                </section>

            </div>

            <div class="fgv09-columns">

                <section class="fgv09-panel">

                    <h3>
                        Registrar gasto con tarjeta
                    </h3>

                    <form
                        id="fgv09-expense-form"
                        class="fgv09-form"
                    >

                        <label>
                            Descripción

                            <input
                                name="description"
                                maxlength="100"
                                required
                            >

                        </label>

                        <label>
                            Categoría

                            <select name="category">

                                ${
                                    ["food", "transport", "housing", "study", "other"]
                                    .map(category => `
                                        <option value="${category}">
                                            ${categories[category]}
                                        </option>
                                    `).join("")
                                }

                            </select>

                        </label>

                        <label>
                            Importe (₽)

                            <input
                                name="amount"
                                placeholder="450,90"
                                required
                            >

                        </label>

                        <label>
                            Tarjeta

                            <select name="card_id">

                                <option value="">
                                    Sin asignar
                                </option>

                                ${cardOptions}

                            </select>

                        </label>

                        <button type="submit">
                            Registrar gasto
                        </button>

                    </form>

                </section>

                <section class="fgv09-panel">

                    <h3>
                        Gastos del mes por tarjeta
                    </h3>

                    ${
                        cards.length
                            ? cards.map(card => `
                                <div class="fgv09-category">

                                    <span>
                                        ${safe(card.alias)}
                                        •••• ${safe(card.last4)}
                                    </span>

                                    <b>
                                        ${money(
                                            cardTotals.get(card.id) || 0
                                        )}
                                    </b>

                                </div>
                              `).join("")

                            : `<p>
                                Añade una tarjeta desde
                                <a href="./cards.html">
                                    Mis tarjetas
                                </a>.
                               </p>`
                    }

                </section>

            </div>

            <section class="fgv09-panel">

                <h3>
                    Asignar tarjeta a gastos existentes
                </h3>

                ${
                    expenseRows ||
                    "<p>No hay gastos registrados.</p>"
                }

            </section>

            <p
                id="fgv09-status"
                class="fgv09-status"
                role="status"
            ></p>
        `;

        attachEvents();
    }

    function attachEvents() {

        const status = document.getElementById(
            "fgv09-status"
        );

        document.getElementById(
            "fgv09-refresh"
        ).addEventListener(
            "click",
            reload
        );

        document.getElementById(
            "fgv09-month"
        ).addEventListener(
            "change",
            event => {

                month = event.target.value;

                if (/^\d{4}-\d{2}$/.test(month)) {
                    reload();
                }
            }
        );

        section.querySelectorAll(
            "[data-movement-id]"
        ).forEach(select => {

            select.addEventListener(
                "change",
                async event => {

                    try {

                        await request(
                            "/api/wallet/links",
                            "POST",
                            {
                                movement_id: Number(
                                    event.target.dataset.movementId
                                ),

                                card_id: event.target.value
                                    ? Number(event.target.value)
                                    : null
                            }
                        );

                        await reload();

                    } catch (error) {

                        status.textContent =
                            error.message;
                    }
                }
            );
        });

        section.querySelectorAll(
            "[data-delete-budget]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    try {

                        await request(
                            `/api/wallet/budgets/${event.target.dataset.deleteBudget}?month=${month}`,
                            "DELETE"
                        );

                        await reload();

                    } catch (error) {

                        status.textContent =
                            error.message;
                    }
                }
            );
        });

        document.getElementById(
            "fgv09-budget-form"
        ).addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const data = new FormData(
                    event.currentTarget
                );

                const amount = amountToKopeks(
                    String(data.get("amount") || "").trim()
                );

                if (amount === null) {
                    status.textContent =
                        "Importe inválido.";
                    return;
                }

                try {

                    await request(
                        "/api/wallet/budgets",
                        "POST",
                        {
                            month,
                            category: data.get("category"),
                            limit_kopeks: amount
                        }
                    );

                    await reload();

                } catch (error) {

                    status.textContent =
                        error.message;
                }
            }
        );

        document.getElementById(
            "fgv09-expense-form"
        ).addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const data = new FormData(
                    event.currentTarget
                );

                const amount = amountToKopeks(
                    String(data.get("amount") || "").trim()
                );

                if (amount === null) {
                    status.textContent =
                        "Importe inválido.";
                    return;
                }

                try {

                    const result = await request(
                        "/api/movements",
                        "POST",
                        {
                            type: "expense",
                            description: String(
                                data.get("description") || ""
                            ).trim(),
                            category: data.get("category"),
                            amount_kopeks: amount
                        }
                    );

                    const cardId = data.get("card_id");

                    if (cardId) {

                        await request(
                            "/api/wallet/links",
                            "POST",
                            {
                                movement_id: result.id,
                                card_id: Number(cardId)
                            }
                        );
                    }

                    await reload();

                } catch (error) {

                    status.textContent =
                        error.message;
                }
            }
        );
    }

    reload();

})();