
// ==========================================
// FALCONI-GIT
// LOGIN.JS - VERSION 0.3
// ==========================================

// Elementos del formulario

const loginForm = document.getElementById("loginForm");

const email = document.getElementById("email");
const password = document.getElementById("password");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");

const togglePassword = document.getElementById("togglePassword");
const formStatus = document.getElementById("formStatus");


// ==========================================
// MOSTRAR Y OCULTAR CONTRASEÑA
// ==========================================

togglePassword.addEventListener("click", function () {

    const isHidden = password.type === "password";

    if (isHidden) {
        password.type = "text";
        togglePassword.textContent = "Ocultar";
    } else {
        password.type = "password";
        togglePassword.textContent = "Mostrar";
    }

    togglePassword.setAttribute(
        "aria-pressed",
        String(isHidden)
    );

    togglePassword.setAttribute(
        "aria-label",
        isHidden
            ? "Ocultar contraseña"
            : "Mostrar contraseña"
    );

});


// ==========================================
// LIMPIAR ERRORES
// ==========================================

function clearErrors() {

    emailError.textContent = "";
    passwordError.textContent = "";
    formStatus.textContent = "";

    email.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
}


// ==========================================
// VALIDAR CORREO
// ==========================================

function validEmail(value) {

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(value);

}


// ==========================================
// ENVÍO DEL FORMULARIO
// ==========================================

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    clearErrors();

    const emailValue = email.value.trim();
    const passwordValue = password.value;

    let hasError = false;

    // Verificar correo electrónico

    if (emailValue === "") {

        emailError.textContent =
            "Introduce tu correo electrónico.";

        email.setAttribute("aria-invalid", "true");

        hasError = true;

    } else if (!validEmail(emailValue)) {

        emailError.textContent =
            "Introduce un correo válido.";

        email.setAttribute("aria-invalid", "true");

        hasError = true;
    }

    // Verificar contraseña

    if (passwordValue === "") {

        passwordError.textContent =
            "Introduce tu contraseña.";

        password.setAttribute("aria-invalid", "true");

        hasError = true;
    }

    // Si existen errores, detener el envío

    if (hasError) {
        return;
    }

    // Demostración: todavía no existe backend

    formStatus.textContent =
        "Formulario validado. La autenticación real estará disponible más adelante.";

});


// ==========================================
// RECUPERAR CONTRASEÑA
// ==========================================

const forgotLink = document.getElementById("forgotLink");

forgotLink.addEventListener("click", function (event) {

    event.preventDefault();

    formStatus.textContent =
        "La recuperación de contraseña estará disponible próximamente.";

});


// ==========================================
// CREAR CUENTA
// ==========================================


const registerLink = document.getElementById("registerLink");

registerLink.addEventListener("click", function (event) {

    event.preventDefault();

    window.location.href = "./register.html";

});


// ==========================================
// SELECTOR DE IDIOMA
// ==========================================

const languageSelect = document.getElementById("language");

languageSelect.addEventListener("change", function () {

    formStatus.textContent =
        "La traducción de la interfaz se incorporará próximamente.";

});
