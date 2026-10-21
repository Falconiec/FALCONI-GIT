
/*
 FALCONI-GIT v0.8.1
 Animación decorativa de tarjeta 3D
*/

"use strict";

(() => {
    const card = document.getElementById(
        "falconiPremiumCard"
    );

    if (!card) {
        return;
    }

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const finePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    );

    function resetCard() {
        card.style.transform = "";

        card.style.setProperty(
            "--pointer-x",
            "48%"
        );

        card.style.setProperty(
            "--pointer-y",
            "20%"
        );
    }

    card.addEventListener("pointermove", event => {
        if (
            reducedMotion.matches ||
            !finePointer.matches ||
            event.pointerType === "touch"
        ) {
            return;
        }

        const rect = card.getBoundingClientRect();

        const x = Math.min(
            1,
            Math.max(
                0,
                (event.clientX - rect.left) / rect.width
            )
        );

        const y = Math.min(
            1,
            Math.max(
                0,
                (event.clientY - rect.top) / rect.height
            )
        );

        const rotateY = (x - 0.5) * 12;
        const rotateX = (0.5 - y) * 10;

        card.style.transform =
            `rotateY(${rotateY}deg) ` +
            `rotateX(${rotateX}deg)`;

        card.style.setProperty(
            "--pointer-x",
            `${x * 100}%`
        );

        card.style.setProperty(
            "--pointer-y",
            `${y * 100}%`
        );
    });

    card.addEventListener(
        "pointerleave",
        resetCard
    );

    reducedMotion.addEventListener(
        "change",
        resetCard
    );
})();
