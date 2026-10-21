

// ==========================================
// FALCONI-GIT - REGISTRO
// Versión 0.4
// Validaciones interactivas
// ==========================================

// ELEMENTOS DEL FORMULARIO

const registerForm = document.getElementById("registerForm");

const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const acceptTerms = document.getElementById("acceptTerms");

const registerStatus = document.getElementById("registerStatus");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById(
    "toggleConfirmPassword"
);

const strengthText = document.getElementById("strengthText");
const strengthFill = document.getElementById("strengthFill");
const matchMessage = document.getElementById("matchMessage");

// ==========================================
// MOSTRAR Y OCULTAR CONTRASEÑAS
// ==========================================

function setupPasswordToggle(button, input) {

    button.addEventListener("click", function () {

        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";

        button.textContent = isHidden ? "Ocultar" : "Mostrar";

        button.setAttribute(
            "aria-pressed",
            String(isHidden)
        );

        button.setAttribute(
            "aria-label",
            isHidden ? "Ocultar contraseña" : "Mostrar contraseña"
        );
    });
}

setupPasswordToggle(togglePassword, password);
setupPasswordToggle(toggleConfirmPassword, confirmPassword);

// ==========================================
// REQUISITOS DE CONTRASEÑA
// ==========================================

function getPasswordRules(value) {

    return {
        length: value.length >= 8,
        upper: /[A-Z]/.test(value),
        lower: /[a-z]/.test(value),
        number: /[0-9]/.test(value)
    };
}

// Actualizar cada requisito visualmente

function updateRule(id, valid, text) {

    const element = document.getElementById(id);

    element.textContent = (valid ? "✓ " : "○ ") + text;

    element.classList.toggle("rule-valid", valid);
}

// ==========================================
// INDICADOR DE CONTRASEÑA
// ==========================================

function updatePasswordStrength() {

    const value = password.value;
    const rules = getPasswordRules(value);

    updateRule(
        "ruleLength",
        rules.length,
        "Mínimo 8 caracteres"
    );

    updateRule(
        "ruleUpper",
        rules.upper,
        "Una letra mayúscula"
    );

    updateRule(
        "ruleLower",
        rules.lower,
        "Una letra minúscula"
    );

    updateRule(
        "ruleNumber",
        rules.number,
        "Un número"
    );

    // Contamos cuántos requisitos se cumplen
    const score = Object.values(rules).filter(Boolean).length;

    // El indicador representa requisitos cumplidos,
    // no una evaluación criptográfica de seguridad.
    const percentage = value.length === 0 ? 0 : score * 25;

    strengthFill.style.width = percentage + "%";

    if (value.length === 0) {

        strengthText.textContent = "Sin evaluar";
        strengthFill.dataset.level = "empty";

    } else if (score <= 2) {

        strengthText.textContent = "Faltan requisitos";
        strengthFill.dataset.level = "low";

    } else if (score === 3) {

        strengthText.textContent = "Casi lista";
        strengthFill.dataset.level = "medium";

    } else {

        strengthText.textContent = "Requisitos cumplidos";
        strengthFill.dataset.level = "complete";
    }
}

password.addEventListener("input", function () {

    updatePasswordStrength();
    updatePasswordMatch();

    clearFieldError(password, "passwordError");
});

// ==========================================
// COMPARAR CONTRASEÑAS
// ==========================================

function updatePasswordMatch() {

    const value = confirmPassword.value;

    matchMessage.classList.remove(
        "match-success",
        "match-error"
    );

    if (value === "") {

        matchMessage.textContent = "";
        return;
    }

    if (password.value === value) {

        matchMessage.textContent = "✓ Las contraseñas coinciden";
        matchMessage.classList.add("match-success");

    } else {

        matchMessage.textContent = "Las contraseñas no coinciden";
        matchMessage.classList.add("match-error");
    }
}

confirmPassword.addEventListener("input", function () {

    updatePasswordMatch();

    clearFieldError(
        confirmPassword,
        "confirmPasswordError"
    );
});

// ==========================================
// ERRORES DE VALIDACIÓN
// ==========================================

function showError(field, errorId, message) {

    document.getElementById(errorId).textContent = message;

    field.setAttribute("aria-invalid", "true");
}

function clearFieldError(field, errorId) {

    document.getElementById(errorId).textContent = "";

    field.removeAttribute("aria-invalid");
}

function clearErrors() {

    registerForm.querySelectorAll(".error-message")
        .forEach(function (element) {

            element.textContent = "";
        });

    registerForm.querySelectorAll("input")
        .forEach(function (element) {

            element.removeAttribute("aria-invalid");
        });

    registerStatus.textContent = "";
}

// Limpiar errores cuando el usuario corrige campos

username.addEventListener("input", function () {
    clearFieldError(username, "usernameError");
});

email.addEventListener("input", function () {
    clearFieldError(email, "emailError");
});

acceptTerms.addEventListener("change", function () {
    clearFieldError(acceptTerms, "termsError");
});

// ==========================================
// VALIDAR CORREO
// ==========================================

function validEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ==========================================
// VALIDAR FORMULARIO COMPLETO
// ==========================================

registerForm.addEventListener("submit", function (event) {

    event.preventDefault();
    clearErrors();

    let isValid = true;
    let firstInvalidField = null;

    function invalidate(field, errorId, message) {

        showError(field, errorId, message);

        if (!firstInvalidField) {
            firstInvalidField = field;
        }

        isValid = false;
    }

    const usernameValue = username.value.trim();
    const emailValue = email.value.trim();

    // Nombre
    if (usernameValue.length < 3) {

        invalidate(
            username,
            "usernameError",
            "El nombre debe tener al menos 3 caracteres."
        );

    } else if (usernameValue.length > 40) {

        invalidate(
            username,
            "usernameError",
            "El nombre no puede superar 40 caracteres."
        );
    }

    // Correo
    if (!validEmail(emailValue)) {

        invalidate(
            email,
            "emailError",
            "Introduce un correo electrónico válido."
        );
    }

    // Contraseña
    const rules = getPasswordRules(password.value);
    const allRulesValid = Object.values(rules).every(Boolean);

    if (!allRulesValid) {

        invalidate(
            password,
            "passwordError",
            "La contraseña debe cumplir los cuatro requisitos."
        );
    }

    // Confirmación
    if (confirmPassword.value === "") {

        invalidate(
            confirmPassword,
            "confirmPasswordError",
            "Confirma tu contraseña."
        );

    } else if (password.value !== confirmPassword.value) {

        invalidate(
            confirmPassword,
            "confirmPasswordError",
            "Las contraseñas no coinciden."
        );
    }

    // Términos
    if (!acceptTerms.checked) {

        invalidate(
            acceptTerms,
            "termsError",
            "Debes aceptar las condiciones para continuar."
        );
    }

    // Si algo falla, enfocar el primer campo inválido
    if (!isValid) {

        firstInvalidField.focus();
        return;
    }

    // Prototipo: no se crean usuarios reales
    registerStatus.textContent =
        "Datos validados correctamente. El registro real se habilitará cuando implementemos el backend.";

    // No guardamos ni enviamos contraseñas.
});

// Inicializar los indicadores
updatePasswordStrength();
updatePasswordMatch();