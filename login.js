
/*
 FALCONI-GIT - LOGIN
 Autenticación con servidor
*/

const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const formStatus = document.getElementById("formStatus");

const togglePassword = document.getElementById("togglePassword");
const registerLink = document.getElementById("registerLink");
const forgotLink = document.getElementById("forgotLink");

const submitButton = document.getElementById("submitButton");

let emailErrorKey = "";
let passwordErrorKey = "";
let statusKey = "";

function updatePasswordToggle() {
    const visible = password.type === "text";

    togglePassword.textContent = t(visible ? "hide" : "show");
    togglePassword.setAttribute("aria-pressed", String(visible));
    togglePassword.setAttribute(
        "aria-label", t(visible ? "hide" : "show")
    );
}

togglePassword.addEventListener("click", function () {
    password.type =
        password.type === "password" ? "text" : "password";

    updatePasswordToggle();
});

function clearErrors() {
    emailError.textContent = "";
    passwordError.textContent = "";
    formStatus.textContent = "";

    emailErrorKey = "";
    passwordErrorKey = "";
    statusKey = "";

    email.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
}

function showError(field, element, key) {
    element.textContent = t(key);
    field.setAttribute("aria-invalid", "true");

    if (field === email) emailErrorKey = key;
    if (field === password) passwordErrorKey = key;
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors();

    let valid = true;

    if (!email.value.trim()) {
        showError(email, emailError, "emailRequired");
        valid = false;

    } else if (!validEmail(email.value.trim())) {
        showError(email, emailError, "emailInvalid");
        valid = false;
    }

    if (!password.value) {
        showError(password, passwordError, "passwordRequired");
        valid = false;
    }

    if (!valid) return;

    submitButton.disabled = true;

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                email: email.value.trim(),
                password: password.value
            })
        });

        if (response.status === 429) {
            statusKey = "tooManyAttempts";
            formStatus.textContent = t(statusKey);
            return;
        }

        if (!response.ok) {
            statusKey = "invalidCredentials";
            formStatus.textContent = t(statusKey);
            return;
        }

        password.value = "";
        window.location.replace("./dashboard.html");

    } catch {
        statusKey = "serverError";
        formStatus.textContent = t(statusKey);

    } finally {
        submitButton.disabled = false;
    }
});

email.addEventListener("input", function () {
    emailError.textContent = "";
    emailErrorKey = "";
    email.removeAttribute("aria-invalid");
});

password.addEventListener("input", function () {
    passwordError.textContent = "";
    passwordErrorKey = "";
    password.removeAttribute("aria-invalid");
});

registerLink.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "./register.html";
});

forgotLink.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "./forgot-password.html";
});

document.addEventListener("languageChanged", function () {
    updatePasswordToggle();

    if (emailErrorKey) emailError.textContent = t(emailErrorKey);
    if (passwordErrorKey) passwordError.textContent = t(passwordErrorKey);
    if (statusKey) formStatus.textContent = t(statusKey);
});

updatePasswordToggle();
