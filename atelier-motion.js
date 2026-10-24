
(() => {
    "use strict";

    const scene = document.getElementById("scene");
    const stage = document.getElementById("card-stage");
    const shell = document.getElementById("premium-shell");
    const choices = [...document.querySelectorAll(".choice")];
    const backgrounds = [...document.querySelectorAll(".ambient")];
    const particles = [...document.querySelectorAll(".particle")];

    const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const target = { x:0, y:0 };
    const current = { x:0, y:0 };

    let variant = "variant-2";
    let switching = false;
    let visible = true;
    let frame = null;

    const basePositions = particles.map((element, index) => ({
        x:0,
        y:0,
        seed:index * 1.7,
        element
    }));

    function animate(time) {
        if (!visible || reduced.matches) {
            frame = null;
            return;
        }

        current.x += (target.x-current.x)*.065;
        current.y += (target.y-current.y)*.065;

        if (!switching) {
            stage.style.transform =
                `rotateY(${current.x*19}deg) ` +
                `rotateX(${-current.y*13}deg) ` +
                `rotateZ(-8deg)`;
        }

        basePositions.forEach(p => {
            const float = Math.sin(time*.0007+p.seed)*13;
            const offsetX = current.x*(p.seed%2? -30:35);
            const offsetY = current.y*(p.seed%2? 25:-25);

            p.element.style.transform =
                `translate3d(${offsetX}px,` +
                `${offsetY+float}px,0)`;
        });

        frame = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (!frame && visible && !reduced.matches) {
            frame = requestAnimationFrame(animate);
        }
    }

    scene.addEventListener("pointermove", event => {
        const rect = scene.getBoundingClientRect();

        target.x =
            (event.clientX-rect.left)/rect.width-.5;

        target.y =
            (event.clientY-rect.top)/rect.height-.5;
    });

    scene.addEventListener("pointerleave", () => {
        target.x = 0;
        target.y = 0;
    });

    async function chooseTheme(next) {
        if (switching || next===variant) return;

        switching = true;

        choices.forEach(button => {
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.variant===next)
            );
        });

        if (reduced.matches) {
            shell.className =
                "fg-card-scene fg-cardskin fg-cardskin--"+next;

            backgrounds.forEach(bg => {
                bg.classList.toggle(
                    "active",
                    bg.dataset.bg===next
                );
            });

            variant = next;
            switching = false;
            return;
        }

        const begin = stage.animate([
            {
                transform:"rotateY(0deg) rotateZ(-8deg)",
                filter:"blur(0px)",
                opacity:1
            },
            {
                transform:"rotateY(360deg) rotateZ(-8deg) scale(.86)",
                filter:"blur(9px)",
                opacity:.7
            }
        ],{
            duration:540,
            easing:"cubic-bezier(.6,0,.8,.4)",
            fill:"forwards"
        });

        await begin.finished.catch(() => {});

        shell.className =
            "fg-card-scene fg-cardskin fg-cardskin--"+next;

        backgrounds.forEach(bg => {
            bg.classList.toggle(
                "active",
                bg.dataset.bg===next
            );
        });

        const finish = stage.animate([
            {
                transform:"rotateY(360deg) rotateZ(-8deg) scale(.86)",
                filter:"blur(9px)",
                opacity:.7
            },
            {
                transform:"rotateY(720deg) rotateZ(-8deg) scale(1)",
                filter:"blur(0px)",
                opacity:1
            }
        ],{
            duration:1000,
            easing:"cubic-bezier(.16,1,.3,1)",
            fill:"forwards"
        });

        await finish.finished.catch(() => {});

        begin.cancel();
        finish.cancel();

        variant = next;
        switching = false;
    }

    choices.forEach(button => {
        button.addEventListener(
            "click",
            () => chooseTheme(button.dataset.variant)
        );
    });

    document.addEventListener("visibilitychange",()=>{
        visible=!document.hidden;

        if (!visible && frame) {
            cancelAnimationFrame(frame);
            frame=null;
        }

        startAnimation();
    });

    reduced.addEventListener?.("change",()=>{
        if (reduced.matches && frame) {
            cancelAnimationFrame(frame);
            frame=null;
            stage.style.transform="rotateZ(-8deg)";
        } else {
            startAnimation();
        }
    });

    stage.style.transform="rotateZ(-8deg)";
    startAnimation();
})();
