
/*
 FALCONI-GIT
 Login multilingüe v0.5
*/

// Elementos
const loginForm = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const formStatus = document.getElementById("formStatus");

const togglePassword = document.getElementById("togglePassword");
const registerLink = document.getElementById("registerLink");
const forgotLink = document.getElementById("forgotLink");

// Conservar las claves de los mensajes activos
let emailErrorKey = "";
let passwordErrorKey = "";
let statusKey = "";

// Mostrar / ocultar contraseña
function updatePasswordToggle() {
    const isVisible = password.type === "text";

    togglePassword.textContent = t(isVisible ? "hide" : "show");
    togglePassword.setAttribute("aria-pressed", String(isVisible));
    togglePassword.setAttribute(
        "aria-label",
        t(isVisible ? "hide" : "show")
    );
}

togglePassword.addEventListener("click", function () {
    password.type = password.type === "password"
        ? "text"
        : "password";

    updatePasswordToggle();
});

// Mostrar errores
function showLoginError(field, element, key) {
    element.textContent = t(key);
    field.setAttribute("aria-invalid", "true");

    if (field === email) emailErrorKey = key;
    if (field === password) passwordErrorKey = key;
}

function clearLoginErrors() {
    emailError.textContent = "";
    passwordError.textContent = "";
    formStatus.textContent = "";

    emailErrorKey = "";
    passwordErrorKey = "";
    statusKey = "";

    email.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Validar formulario
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearLoginErrors();

    let valid = true;

    if (email.value.trim() === "") {
        showLoginError(email, emailError, "emailRequired");
        valid = false;
    } else if (!validEmail(email.value.trim())) {
        showLoginError(email, emailError, "emailInvalid");
        valid = false;
    }

    if (password.value === "") {
        showLoginError(password, passwordError, "passwordRequired");
        valid = false;
    }

    if (!valid) return;

    // No existe autenticación real todavía.
    statusKey = "loginSuccess";
    formStatus.textContent = t(statusKey);
});

// Borrar error al modificar el campo
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

// Navegación al registro
registerLink.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "./register.html";
});

// Recuperación pendiente
forgotLink.addEventListener("click", function (event) {
    event.preventDefault();

    statusKey = "recoveryPending";
    formStatus.textContent = t(statusKey);
});

// Mantener mensajes traducidos cuando cambia el idioma
document.addEventListener("languageChanged", function () {
    updatePasswordToggle();

    if (emailErrorKey) {
        emailError.textContent = t(emailErrorKey);
    }

    if (passwordErrorKey) {
        passwordError.textContent = t(passwordErrorKey);
    }

    if (statusKey) {
        formStatus.textContent = t(statusKey);
    }
});

updatePasswordToggle();