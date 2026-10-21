
/*
 FALCONI-GIT
 Dashboard autenticado
*/

const welcomeName = document.getElementById("welcomeName");
const avatar = document.getElementById("avatar");
const logoutButton = document.getElementById("logoutButton");
const dashboardStatus = document.getElementById("dashboardStatus");

let currentUser = null;

function renderWelcome() {
    if (!currentUser) return;

    const names = {
        es: "Hola",
        en: "Hello",
        ru: "Привет"
    };

    const lang = typeof currentLanguage !== "undefined"
        ? currentLanguage
        : "es";

    // textContent evita interpretar el nombre como HTML.
    welcomeName.textContent =
        `${names[lang] || names.es}, ${currentUser.username}.`;

    avatar.textContent =
        currentUser.username.charAt(0).toUpperCase();
}

async function loadDashboard() {
    try {
        const response = await fetch("/api/me", {
            credentials: "same-origin"
        });

        if (!response.ok) {
            window.location.replace("./index.html");
            return;
        }

        const data = await response.json();

        currentUser = data.user;
        renderWelcome();

    } catch {
        dashboardStatus.textContent =
            t("serverError");
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

        if (!response.ok) throw new Error("LOGOUT_FAILED");

        window.location.replace("./index.html");

    } catch {
        logoutButton.disabled = false;
        dashboardStatus.textContent = t("serverError");
    }
});

document.addEventListener("languageChanged", renderWelcome);

loadDashboard();
