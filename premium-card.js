"use strict";

/*
 FALCONI-GIT v0.8.1
 Premium Auth - Componente compartido

 Login
 Registro
 Recuperacion de contrasena
*/

(() => {

    document.body.classList.add(
        "falconi-auth-premium"
    );

    // CORREGIR LOGOS ANTIGUOS

    document.querySelectorAll(
        ".brand-header .logo-box"
    ).forEach(box => {

        if (!box.querySelector("img")) {
            return;
        }

        box.innerHTML = `
            <span class="fg-auth-mark"
                  role="img"
                  aria-label="Logo FALCONI">

                <span class="fg-auth-mark-symbol">
                    F.
                </span>

                <span class="fg-auth-mark-caption">
                    FALCONI
                </span>

            </span>
        `;
    });

    // ACTUALIZAR TARJETA ANTIGUA

    const oldCard = document.querySelector(
        ".card-stage .finance-card"
    );

    if (oldCard) {

        const scene = document.createElement("div");

        scene.className = "fg-card-scene";

        scene.innerHTML = `
            <div class="fg-premium-card"
                 role="img"
                 aria-label="Tarjeta decorativa FALCONI-GIT con numeracion ficticia">

                <div class="fg-card-metal"></div>
                <div class="fg-card-shine"></div>

                <div class="fg-card-content">

                    <div class="fg-card-top">

                        <div class="fg-card-chip"></div>

                        <div class="fg-card-brand">
                            <span class="fg-card-brand-symbol">
                                F.
                            </span>

                            <span class="fg-card-brand-name">
                                FALCONI
                            </span>
                        </div>

                    </div>

                    <div class="fg-card-number">
                        4874 2479 2847 1204
                    </div>

                    <div class="fg-card-expiry">
                        <span class="fg-card-expiry-label">
                            VALID THRU
                        </span>

                        <span class="fg-card-expiry-date">
                            08/28
                        </span>
                    </div>

                    <div class="fg-card-bottom">
                        <span class="fg-card-holder">
                            FALCONI-GIT
                        </span>

                        <span class="fg-card-corner">
                            F.
                        </span>
                    </div>

                </div>
            </div>
        `;

        oldCard.replaceWith(scene);
    }

    // ANIMACION 3D PARA TODAS LAS TARJETAS

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const finePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)"
    );

    document.querySelectorAll(
        ".fg-premium-card"
    ).forEach(card => {

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

        card.addEventListener(
            "pointermove",
            event => {

                if (
                    reducedMotion.matches ||
                    !finePointer.matches ||
                    event.pointerType === "touch"
                ) {
                    return;
                }

                const rect =
                    card.getBoundingClientRect();

                const x = Math.max(
                    0,
                    Math.min(
                        1,
                        (event.clientX - rect.left) /
                        rect.width
                    )
                );

                const y = Math.max(
                    0,
                    Math.min(
                        1,
                        (event.clientY - rect.top) /
                        rect.height
                    )
                );

                card.style.transform =
                    `rotateY(${(x - .5) * 12}deg) ` +
                    `rotateX(${(.5 - y) * 10}deg)`;

                card.style.setProperty(
                    "--pointer-x",
                    `${x * 100}%`
                );

                card.style.setProperty(
                    "--pointer-y",
                    `${y * 100}%`
                );
            }
        );

        card.addEventListener(
            "pointerleave",
            resetCard
        );

        reducedMotion.addEventListener(
            "change",
            resetCard
        );
    });

})();