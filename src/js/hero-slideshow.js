document.addEventListener("DOMContentLoaded", () => {
    const slides = document.querySelectorAll(".hero-bg-slide");
    if (slides.length < 2) return;

    let current = 0;
    const intervalMs = 5000;

    setInterval(() => {
        slides[current].classList.remove("active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("active");
    }, intervalMs);
});
