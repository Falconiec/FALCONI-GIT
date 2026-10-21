
/*
 FALCONI-GIT
 Control de idioma v0.5
*/

const supportedLanguages = ["es", "en", "ru"];

function getSavedLanguage() {
    try {
        const value = localStorage.getItem("falconi-language");
        return supportedLanguages.includes(value) ? value : "es";
    } catch {
        return "es";
    }
}

let currentLanguage = getSavedLanguage();

function t(key) {
    const dictionary = translations[currentLanguage] || translations.es;
    return dictionary[key] ?? translations.es[key] ?? key;
}

function applyLanguage() {
    document.documentElement.lang = currentLanguage;

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
        element.textContent = t(element.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
        element.placeholder = t(element.dataset.i18nPlaceholder);
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
        element.setAttribute(
            "aria-label",
            t(element.dataset.i18nAriaLabel)
        );
    });

    const selector = document.getElementById("language");

    if (selector) {
        selector.value = currentLanguage;
    }

    document.dispatchEvent(new CustomEvent("languageChanged"));
}

function setLanguage(language) {
    if (!supportedLanguages.includes(language)) return;

    currentLanguage = language;

    try {
        localStorage.setItem("falconi-language", language);
    } catch {
        // El selector funciona incluso sin almacenamiento.
    }

    applyLanguage();
}

document.addEventListener("DOMContentLoaded", function () {
    const selector = document.getElementById("language");

    if (selector) {
        selector.addEventListener("change", function () {
            setLanguage(selector.value);
        });
    }

    applyLanguage();
});