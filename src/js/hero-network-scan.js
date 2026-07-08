document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("home-hero");
    const canvas = document.getElementById("hero-network-scan");
    if (!wrap || !canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const DENSITY = 0.00006; // nodos por px^2
    const MAX_NODES = 110;
    const LINK_DIST = 140;
    const PING_EVERY = 900;

    let ctx, w, h, nodes;

    const fitCanvas = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = wrap.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        w = rect.width;
        h = rect.height;
    };

    const seedNodes = () => {
        const count = Math.min(MAX_NODES, Math.max(30, Math.round(w * h * DENSITY)));
        nodes = Array.from({ length: count }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
        }));
    };

    fitCanvas();
    seedNodes();

    const mouse = { x: -9999, y: -9999, active: false };
    let pings = [];
    let lastPing = 0;

    const setMouse = (clientX, clientY) => {
        const r = wrap.getBoundingClientRect();
        mouse.x = clientX - r.left;
        mouse.y = clientY - r.top;
        mouse.active = true;
    };

    wrap.addEventListener("mousemove", (e) => setMouse(e.clientX, e.clientY));
    wrap.addEventListener("mouseleave", () => {
        mouse.active = false;
    });
    wrap.addEventListener(
        "touchmove",
        (e) => {
            if (e.touches.length) setMouse(e.touches[0].clientX, e.touches[0].clientY);
        },
        { passive: true }
    );
    wrap.addEventListener("touchend", () => {
        mouse.active = false;
    });

    function frame(t) {
        ctx.clearRect(0, 0, w, h);

        for (const n of nodes) {
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > w) n.vx *= -1;
            if (n.y < 0 || n.y > h) n.vy *= -1;
        }

        if (mouse.active && t - lastPing > PING_EVERY) {
            pings.push({ x: mouse.x, y: mouse.y, r: 0, alpha: 0.85 });
            lastPing = t;
        }

        ctx.lineWidth = 1.1;
        ctx.shadowBlur = 0;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d = Math.hypot(dx, dy);
                if (d < LINK_DIST) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.32 * (1 - d / LINK_DIST)})`;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        pings = pings.filter((p) => p.alpha > 0.02);
        for (const p of pings) {
            p.r += 2.6;
            p.alpha *= 0.965;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        for (const n of nodes) {
            let lit = false;
            for (const p of pings) {
                const d = Math.hypot(n.x - p.x, n.y - p.y);
                if (Math.abs(d - p.r) < 26) lit = true;
            }
            if (mouse.active) {
                const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
                if (dm < 120) {
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - dm / 120)})`;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
            ctx.shadowBlur = lit ? 10 : 4;
            ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
            ctx.beginPath();
            ctx.arc(n.x, n.y, lit ? 3.2 : 2, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = lit ? 1 : 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        if (mouse.active) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        if (!reduceMotion) requestAnimationFrame(frame);
    }

    if (reduceMotion) {
        frame(0);
    } else {
        requestAnimationFrame(frame);
    }

    let resizeTimeout = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            fitCanvas();
            seedNodes();
        }, 200);
    });
});
