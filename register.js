
// ==========================================
// FALCONI-GIT
// REGISTRO DE USUARIOS - PROTOTIPO
// ==========================================

// Obtener elementos
const registerForm = document.getElementById("registerForm");

const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const acceptTerms = document.getElementById("acceptTerms");

const registerStatus = document.getElementById("registerStatus");

// Mostrar un error junto a un campo
function showError(fieldId, message) {

    const errorElement = document.getElementById(fieldId);

    errorElement.textContent = message;
}

// Limpiar los errores
function clearErrors() {

    const errors = document.querySelectorAll(".error-message");

    errors.forEach(function (error) {
        error.textContent = "";
    });

    const fields = registerForm.querySelectorAll("input");

    fields.forEach(function (field) {
        field.removeAttribute("aria-invalid");
    });

    registerStatus.textContent = "";
}

// Comprobar correo
function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Validar al pulsar Crear cuenta
registerForm.addEventListener("submit", function (event) {

    event.preventDefault();
    clearErrors();

    let isValid = true;

    const usernameValue = username.value.trim();
    const emailValue = email.value.trim();

    if (usernameValue.length < 3) {

        showError(
            "usernameError",
            "El nombre debe tener al menos 3 caracteres."
        );

        username.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (!validEmail(emailValue)) {

        showError(
            "emailError",
            "Introduce un correo electrónico válido."
        );

        email.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (password.value.length < 8) {

        showError(
            "passwordError",
            "La contraseña debe tener al menos 8 caracteres."
        );

        password.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (confirmPassword.value !== password.value) {

        showError(
            "confirmPasswordError",
            "Las contraseñas no coinciden."
        );

        confirmPassword.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (!acceptTerms.checked) {

        showError(
            "termsError",
            "Debes aceptar las condiciones para continuar."
        );

        acceptTerms.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (!isValid) {
        return;
    }

    // Prototipo: aún no crea cuentas reales.
    registerStatus.textContent =
        "Formulario validado correctamente. El registro real estará disponible cuando implementemos el servidor.";

});