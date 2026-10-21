
const resetForm = document.getElementById("resetForm");
const resetStatus = document.getElementById("resetStatus");

const url = new URL(window.location.href);
const token = url.searchParams.get("token");

// Quitamos el token de la barra de direcciones.
// Permanece solo en memoria durante esta visita.
history.replaceState({}, "", "/reset-password.html");

let resetMessageKey = "";

resetForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (password !== confirm) {
        resetMessageKey = "passwordsDifferentError";
        resetStatus.textContent = t(resetMessageKey);
        return;
    }

    const valid =
        password.length >= 8 &&
        password.length <= 128 &&
        /\p{Lu}/u.test(password) &&
        /\p{Ll}/u.test(password) &&
        /\p{Nd}/u.test(password);

    if (!valid) {
        resetMessageKey = "passwordInvalid";
        resetStatus.textContent = t(resetMessageKey);
        return;
    }

    if (!token) {
        resetMessageKey = "invalidResetLink";
        resetStatus.textContent = t(resetMessageKey);
        return;
    }

    const button = resetForm.querySelector("button");
    button.disabled = true;

    try {
        const response = await fetch("/api/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token, password })
        });

        if (!response.ok) {
            throw new Error("RESET_FAILED");
        }

        resetMessageKey = "resetSuccess";
        resetStatus.textContent = t(resetMessageKey);
        resetForm.reset();
        button.disabled = true;

    } catch {
        resetMessageKey = "invalidResetLink";
        resetStatus.textContent = t(resetMessageKey);
        button.disabled = false;
    }
});

document.addEventListener("languageChanged", function () {
    if (resetMessageKey) {
        resetStatus.textContent = t(resetMessageKey);
    }
});
