
const forgotForm = document.getElementById("forgotForm");
const forgotStatus = document.getElementById("forgotStatus");

let forgotMessageKey = "";

forgotForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const button = forgotForm.querySelector("button");
    const email = document.getElementById("email").value.trim();

    button.disabled = true;
    forgotStatus.textContent = "";

    try {
        const response = await fetch("/api/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            throw new Error("REQUEST_FAILED");
        }

        forgotMessageKey = "recoverySent";
        forgotStatus.textContent = t(forgotMessageKey);

    } catch {
        forgotMessageKey = "serverError";
        forgotStatus.textContent = t(forgotMessageKey);

    } finally {
        button.disabled = false;
    }
});

document.addEventListener("languageChanged", function () {
    if (forgotMessageKey) {
        forgotStatus.textContent = t(forgotMessageKey);
    }
});
