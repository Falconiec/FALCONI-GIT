
// FALCONI-GIT
// Login - Versión 0.1
// Prototipo: todavía no existe autenticación real.

// Obtener elementos del HTML
const loginForm = document.getElementById("loginForm");

const email = document.getElementById("email");
const password = document.getElementById("password");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");

const togglePassword = document.getElementById("togglePassword");
const formStatus = document.getElementById("formStatus");

const submitButton = loginForm.querySelector(
    'button[type="submit"]'
);

// Mostrar y ocultar contraseña
togglePassword.addEventListener("click", function () {

    const isHidden = password.type === "password";

    password.type = isHidden ? "text" : "password";

    togglePassword.textContent = isHidden
        ? "Ocultar"
        : "Mostrar";

    togglePassword.setAttribute(
        "aria-pressed",
        String(isHidden)
    );

    togglePassword.setAttribute(
        "aria-label",
        isHidden ? "Ocultar contraseña" : "Mostrar contraseña"
    );

});

// Limpiar los errores anteriores
function clearErrors() {

    emailError.textContent = "";
    passwordError.textContent = "";
    formStatus.textContent = "";

    email.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
}

// Validar correo electrónico
function isValidEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

}

// Validar el formulario
loginForm.addEventListener("submit", function (event) {

    // Evita recargar la página
    event.preventDefault();

    clearErrors();

    const emailValue = email.value.trim();
    const passwordValue = password.value;

    let valid = true;

    // Comprobar correo
    if (emailValue === "") {

        emailError.textContent = "Introduce tu correo.";
        email.setAttribute("aria-invalid", "true");

        valid = false;

    } else if (!isValidEmail(emailValue)) {

        emailError.textContent = "Introduce un correo válido.";
        email.setAttribute("aria-invalid", "true");

        valid = false;
    }

    // Comprobar contraseña
    if (passwordValue === "") {

        passwordError.textContent = "Introduce tu contraseña.";
        password.setAttribute("aria-invalid", "true");

        valid = false;
    }

    if (!valid) {
        return;
    }

    // Simulación de envío del formulario
    submitButton.disabled = true;
    submitButton.textContent = "Verificando...";

    formStatus.textContent =
        "Formulario validado. La autenticación real estará disponible más adelante.";

    // Restaurar botón (sin simular un acceso exitoso)
    submitButton.disabled = false;
    submitButton.innerHTML =
        'Iniciar sesión <span aria-hidden="true">→</span>';
});

// Funciones que se desarrollarán en etapas posteriores
document.getElementById("forgotPassword")
    .addEventListener("click", function (event) {

        event.preventDefault();

        formStatus.textContent =
            "La recuperación de contraseña estará disponible próximamente.";
    });

document.getElementById("registerLink")
    .addEventListener("click", function (event) {

        event.preventDefault();

        formStatus.textContent =
            "El registro de usuarios estará disponible próximamente.";
    });