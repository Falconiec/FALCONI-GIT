
/*
  FALCONI-GIT
  Control de idiomas - v0.5
*/

const supportedLanguages = ["es", "en", "ru"];

function getLanguage() {
    try {
        const saved = localStorage.getItem("falconi-language");
        return supportedLanguages.includes(saved) ? saved : "es";
    } catch {
        return "es";
    }
}

let currentLanguage = getLanguage();

// Obtener una traducción por clave
function t(key) {
    const dictionary = translations[currentLanguage] || translations.es;
    return dictionary[key] || translations.es[key] || key;
}

// Actualizar la interfaz
function applyLanguage() {

    document.documentElement.lang = currentLanguage;

    // Traducir textos visibles
    document.querySelectorAll("[data-i18n]").forEach(function (element) {
        const key = element.dataset.i18n;
        element.textContent = t(key);
    });

    // Traducir placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
        const key = element.dataset.i18nPlaceholder;
        element.placeholder = t(key);
    });

    // Traducir etiquetas de accesibilidad
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
        const key = element.dataset.i18nAriaLabel;
        element.setAttribute("aria-label", t(key));
    });

    // Sincronizar selector
    const selector = document.getElementById("language");

    if (selector) {
        selector.value = currentLanguage;
    }

    // Avisar a otras funciones de que cambió el idioma
    document.dispatchEvent(new CustomEvent("languageChanged"));
}

// Cambiar idioma
function setLanguage(language) {

    if (!supportedLanguages.includes(language)) {
        return;
    }

    currentLanguage = language;

    try {
        localStorage.setItem("falconi-language", language);
    } catch {
        // La página puede funcionar sin guardar la preferencia.
    }

    applyLanguage();
}

// Inicializar
document.addEventListener("DOMContentLoaded", function () {

    const selector = document.getElementById("language");

    if (selector) {
        selector.addEventListener("change", function () {
            setLanguage(this.value);
        });
    }

    applyLanguage();
});