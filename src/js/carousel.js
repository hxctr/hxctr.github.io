document.addEventListener("DOMContentLoaded", () => {
    const track = document.querySelector(".cert-track");
    if (!track) return;

    const originalSlides = Array.from(track.children);
    const canLoop = originalSlides.length > 1;

    // Clonamos el set completo antes y despues de los originales para que,
    // al llegar al final, lo que se ve a continuacion sea visualmente
    // identico al inicio (y viceversa) — el "salto" real ocurre en silencio
    // dentro de la zona clonada, donde es imperceptible.
    if (canLoop) {
        const cloneBefore = originalSlides.map((slide) => slide.cloneNode(true));
        const cloneAfter = originalSlides.map((slide) => slide.cloneNode(true));
        track.prepend(...cloneBefore);
        track.append(...cloneAfter);
    }

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        document.querySelectorAll(".cert-slide").forEach((slide) => {
            const canvas = slide.querySelector(".cert-canvas");
            const pdfUrl = slide.dataset.pdf;

            pdfjsLib
                .getDocument(pdfUrl)
                .promise.then((pdf) => pdf.getPage(1))
                .then((page) => {
                    const targetWidth = canvas.clientWidth || 200;
                    const unscaledViewport = page.getViewport({ scale: 1 });
                    const scale = targetWidth / unscaledViewport.width;
                    const viewport = page.getViewport({ scale });

                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    const context = canvas.getContext("2d");
                    page.render({ canvasContext: context, viewport });
                })
                .catch((err) => {
                    console.error("No se pudo renderizar el certificado:", pdfUrl, err);
                });
        });
    }

    const prevBtn = document.querySelector(".cert-prev");
    const nextBtn = document.querySelector(".cert-next");

    const getSlideStep = () => {
        const slide = track.querySelector(".cert-slide");
        if (!slide) return 0;
        const gap = parseFloat(getComputedStyle(track).gap) || 0;
        return slide.getBoundingClientRect().width + gap;
    };

    // Ancho exacto de un set completo (N slides), para saltar entre
    // la zona clonada y la zona real sin desalinear el scroll-snap.
    let setWidth = 0;
    if (canLoop) {
        setWidth = originalSlides.length * getSlideStep();
        // "instant" es necesario porque .cert-track tiene scroll-behavior: smooth
        // en CSS, que de lo contrario animaria tambien este reposicionamiento inicial.
        track.scrollTo({ left: setWidth, behavior: "instant" });
    }

    const recenter = () => {
        if (!canLoop || setWidth <= 0) return;
        if (track.scrollLeft < setWidth) {
            track.scrollTo({ left: track.scrollLeft + setWidth, behavior: "instant" });
        } else if (track.scrollLeft >= setWidth * 2) {
            track.scrollTo({ left: track.scrollLeft - setWidth, behavior: "instant" });
        }
    };

    const scrollByOneSlide = (direction) => {
        const step = getSlideStep();
        if (!step) return;
        track.scrollBy({ left: direction * step, behavior: "smooth" });
    };

    if (prevBtn) prevBtn.addEventListener("click", () => scrollByOneSlide(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => scrollByOneSlide(1));

    // Tras cada scroll (por boton o drag manual), esperamos a que se
    // asiente y, si quedamos parados en la zona clonada, reposicionamos
    // al instante (sin animacion) al punto equivalente del set real.
    let settleTimeout = null;
    track.addEventListener("scroll", () => {
        clearTimeout(settleTimeout);
        settleTimeout = setTimeout(recenter, 150);
    });
});
