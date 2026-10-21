
/*
 FALCONI-GIT - REGISTRO
 Autenticación real v0.6
*/

const registerForm = document.getElementById("registerForm");

const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const acceptTerms = document.getElementById("acceptTerms");

const togglePassword = document.getElementById("togglePassword");
const toggleConfirmPassword =
    document.getElementById("toggleConfirmPassword");

const strengthText = document.getElementById("strengthText");
const strengthFill = document.getElementById("strengthFill");
const matchMessage = document.getElementById("matchMessage");
const registerStatus = document.getElementById("registerStatus");
const registerButton = document.getElementById("registerButton");

const activeErrors = {};
let statusKey = "";

function updateToggle(button, input) {
    const visible = input.type === "text";

    button.textContent = t(visible ? "hide" : "show");
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute(
        "aria-label",
        t(visible ? "hide" : "show")
    );
}

function setupToggle(button, input) {
    button.addEventListener("click", function () {
        input.type = input.type === "password"
            ? "text"
            : "password";

        updateToggle(button, input);
    });
}

setupToggle(togglePassword, password);
setupToggle(toggleConfirmPassword, confirmPassword);

function getPasswordRules(value) {
    return {
        length: value.length >= 8 && value.length <= 128,
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

function updatePasswordStrength() {
    const value = password.value;
    const rules = getPasswordRules(value);

    updateRule("ruleLength", rules.length, "ruleLength");
    updateRule("ruleUpper", rules.upper, "ruleUpper");
    updateRule("ruleLower", rules.lower, "ruleLower");
    updateRule("ruleNumber", rules.number, "ruleNumber");

    const score = Object.values(rules).filter(Boolean).length;

    strengthFill.style.width =
        (value.length === 0 ? 0 : score * 25) + "%";

    if (!value.length) {
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

function updatePasswordMatch() {
    matchMessage.classList.remove(
        "match-success",
        "match-error"
    );

    if (!confirmPassword.value) {
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

function showError(field, id, key) {
    document.getElementById(id).textContent = t(key);
    field.setAttribute("aria-invalid", "true");
    activeErrors[id] = key;
}

function clearFieldError(field, id) {
    document.getElementById(id).textContent = "";
    field.removeAttribute("aria-invalid");
    delete activeErrors[id];
}

function clearErrors() {
    registerForm.querySelectorAll(".error-message")
        .forEach(element => element.textContent = "");

    registerForm.querySelectorAll("input")
        .forEach(element => element.removeAttribute("aria-invalid"));

    for (const key of Object.keys(activeErrors)) {
        delete activeErrors[key];
    }

    registerStatus.textContent = "";
    statusKey = "";
}

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

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearErrors();

    let valid = true;
    let firstInvalid = null;

    function invalidate(field, id, key) {
        showError(field, id, key);
        valid = false;
        if (!firstInvalid) firstInvalid = field;
    }

    const name = username.value.trim();
    const address = email.value.trim();
    const rules = getPasswordRules(password.value);

    if (name.length < 3) {
        invalidate(username, "usernameError", "usernameInvalid");
    } else if (name.length > 40) {
        invalidate(username, "usernameError", "usernameTooLong");
    }

    if (!validEmail(address)) {
        invalidate(email, "emailError", "emailInvalid");
    }

    if (!Object.values(rules).every(Boolean)) {
        invalidate(password, "passwordError", "passwordInvalid");
    }

    if (!confirmPassword.value) {
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

    if (!acceptTerms.checked) {
        invalidate(acceptTerms, "termsError", "termsRequired");
    }

    if (!valid) {
        firstInvalid.focus();
        return;
    }

    registerButton.disabled = true;

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                username: name,
                email: address,
                password: password.value
            })
        });

        if (!response.ok) {
            statusKey = response.status === 409
                ? "registrationFailed"
                : response.status === 429
                    ? "tooManyAttempts"
                    : "serverError";

            registerStatus.textContent = t(statusKey);
            return;
        }

        password.value = "";
        confirmPassword.value = "";

        window.location.replace("./dashboard.html");

    } catch {
        statusKey = "serverError";
        registerStatus.textContent = t(statusKey);

    } finally {
        registerButton.disabled = false;
    }
});

document.addEventListener("languageChanged", function () {
    updateToggle(togglePassword, password);
    updateToggle(toggleConfirmPassword, confirmPassword);

    updatePasswordStrength();
    updatePasswordMatch();

    for (const [id, key] of Object.entries(activeErrors)) {
        document.getElementById(id).textContent = t(key);
    }

    if (statusKey) {
        registerStatus.textContent = t(statusKey);
    }
});

updateToggle(togglePassword, password);
updateToggle(toggleConfirmPassword, confirmPassword);
updatePasswordStrength();
updatePasswordMatch();
