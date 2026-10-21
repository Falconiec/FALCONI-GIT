
/*
 FALCONI-GIT
 Registro multilingüe v0.5
*/

// Elementos
const registerForm = document.getElementById("registerForm");

const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const acceptTerms = document.getElementById("acceptTerms");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

const strengthText = document.getElementById("strengthText");
const strengthFill = document.getElementById("strengthFill");
const matchMessage = document.getElementById("matchMessage");
const registerStatus = document.getElementById("registerStatus");

// Mensajes de error activos
const activeErrors = {};
let statusKey = "";

// Mostrar y ocultar contraseñas
function setupToggle(button, input) {
    button.addEventListener("click", function () {
        input.type = input.type === "password" ? "text" : "password";
        updateToggle(button, input);
    });
}

function updateToggle(button, input) {
    const visible = input.type === "text";

    button.textContent = t(visible ? "hide" : "show");
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", t(visible ? "hide" : "show"));
}

setupToggle(togglePassword, password);
setupToggle(toggleConfirmPassword, confirmPassword);

// Reglas de contraseña
function getPasswordRules(value) {
    return {
        length: value.length >= 8,
        upper: /\p{Lu}/u.test(value),
        lower: /\p{Ll}/u.test(value),
        number: /\p{Nd}/u.test(value)
    };
}

function updateRule(id, valid, key) {
    const element = document.getElementById(id);

    element.textContent = (valid ? "✓ " : "○ ") + t(key);
    element.classList.toggle("rule-valid", valid);
}

// Indicador de requisitos
function updatePasswordStrength() {
    const value = password.value;
    const rules = getPasswordRules(value);

    updateRule("ruleLength", rules.length, "ruleLength");
    updateRule("ruleUpper", rules.upper, "ruleUpper");
    updateRule("ruleLower", rules.lower, "ruleLower");
    updateRule("ruleNumber", rules.number, "ruleNumber");

    const score = Object.values(rules).filter(Boolean).length;
    const percentage = value.length === 0 ? 0 : score * 25;

    strengthFill.style.width = percentage + "%";

    if (value.length === 0) {
        strengthText.textContent = t("notEvaluated");
        strengthFill.dataset.level = "empty";

    } else if (score <= 2) {
        strengthText.textContent = t("requirementsMissing");
        strengthFill.dataset.level = "low";

    } else if (score === 3) {
        strengthText.textContent = t("almostReady");
        strengthFill.dataset.level = "medium";

    } else {
        strengthText.textContent = t("requirementsComplete");
        strengthFill.dataset.level = "complete";
    }
}

// Comparación de contraseñas
function updatePasswordMatch() {
    matchMessage.classList.remove(
        "match-success",
        "match-error"
    );

    if (confirmPassword.value === "") {
        matchMessage.textContent = "";
        return;
    }

    if (password.value === confirmPassword.value) {
        matchMessage.textContent = "✓ " + t("passwordsMatch");
        matchMessage.classList.add("match-success");

    } else {
        matchMessage.textContent = t("passwordsDifferent");
        matchMessage.classList.add("match-error");
    }
}

// Mostrar errores
function showError(field, errorId, key) {
    const element = document.getElementById(errorId);

    element.textContent = t(key);
    field.setAttribute("aria-invalid", "true");

    activeErrors[errorId] = key;
}

// Limpiar un error
function clearFieldError(field, errorId) {
    document.getElementById(errorId).textContent = "";
    field.removeAttribute("aria-invalid");
    delete activeErrors[errorId];
}

// Limpiar todos los errores
function clearErrors() {
    registerForm.querySelectorAll(".error-message")
        .forEach(function (element) {
            element.textContent = "";
        });

    registerForm.querySelectorAll("input")
        .forEach(function (element) {
            element.removeAttribute("aria-invalid");
        });

    Object.keys(activeErrors).forEach(function (key) {
        delete activeErrors[key];
    });

    statusKey = "";
    registerStatus.textContent = "";
}

// Actualizar requisitos mientras se escribe
password.addEventListener("input", function () {
    updatePasswordStrength();
    updatePasswordMatch();
    clearFieldError(password, "passwordError");
});

confirmPassword.addEventListener("input", function () {
    updatePasswordMatch();
    clearFieldError(confirmPassword, "confirmPasswordError");
});

username.addEventListener("input", function () {
    clearFieldError(username, "usernameError");
});

email.addEventListener("input", function () {
    clearFieldError(email, "emailError");
});

acceptTerms.addEventListener("change", function () {
    clearFieldError(acceptTerms, "termsError");
});

// Validar correo
function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Enviar formulario
registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();

    let isValid = true;
    let firstInvalidField = null;

    function invalidate(field, errorId, key) {
        showError(field, errorId, key);

        if (!firstInvalidField) {
            firstInvalidField = field;
        }

        isValid = false;
    }

    const usernameValue = username.value.trim();
    const emailValue = email.value.trim();

    // Nombre
    if (usernameValue.length < 3) {
        invalidate(username, "usernameError", "usernameInvalid");

    } else if (usernameValue.length > 40) {
        invalidate(username, "usernameError", "usernameTooLong");
    }

    // Correo
    if (emailValue === "") {
        invalidate(email, "emailError", "emailRequired");

    } else if (!validEmail(emailValue)) {
        invalidate(email, "emailError", "emailInvalid");
    }

    // Contraseña
    const rules = getPasswordRules(password.value);

    if (!Object.values(rules).every(Boolean)) {
        invalidate(password, "passwordError", "passwordInvalid");
    }

    // Confirmación
    if (confirmPassword.value === "") {
        invalidate(
            confirmPassword,
            "confirmPasswordError",
            "confirmRequired"
        );

    } else if (password.value !== confirmPassword.value) {
        invalidate(
            confirmPassword,
            "confirmPasswordError",
            "passwordsDifferentError"
        );
    }

    // Aceptación
    if (!acceptTerms.checked) {
        invalidate(acceptTerms, "termsError", "termsRequired");
    }

    if (!isValid) {
        firstInvalidField.focus();
        return;
    }

    // No crea cuentas reales ni almacena contraseñas
    statusKey = "registerSuccess";
    registerStatus.textContent = t(statusKey);
});

// Cuando cambia el idioma
document.addEventListener("languageChanged", function () {
    updateToggle(togglePassword, password);
    updateToggle(toggleConfirmPassword, confirmPassword);

    updatePasswordStrength();
    updatePasswordMatch();

    // Traducir errores ya visibles
    Object.entries(activeErrors).forEach(function ([id, key]) {
        document.getElementById(id).textContent = t(key);
    });

    if (statusKey) {
        registerStatus.textContent = t(statusKey);
    }
});

// Estado inicial
updateToggle(togglePassword, password);
updateToggle(toggleConfirmPassword, confirmPassword);
updatePasswordStrength();
updatePasswordMatch();