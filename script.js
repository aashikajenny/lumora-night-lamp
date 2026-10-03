/* =========================================================
   LUMORA — interactions & animations
   ========================================================= */
(() => {
  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const body = document.body;
  const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = {
    honey: [255, 170, 85],
    ember: [255, 120, 50],
    moon: [180, 205, 255],
    aurora: [110, 240, 200],
    rose: [255, 130, 180],
  };
  let userColor = COLORS.honey.slice(); // colour chosen in the studio

  /* ---------------- Smooth scroll (Lenis) ---------------- */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------------- Colour helpers ---------------- */
  const colorState = new WeakMap();
  function colorTo(el, prop, rgb, duration = 1.2) {
    let s = colorState.get(el);
    if (!s) {
      const cur = getComputedStyle(el).getPropertyValue(prop).split(",").map((n) => parseFloat(n));
      s = { r: cur[0] || 255, g: cur[1] || 170, b: cur[2] || 85 };
      colorState.set(el, s);
    }
    gsap.to(s, {
      r: rgb[0], g: rgb[1], b: rgb[2], duration, ease: "power2.out", overwrite: true,
      onUpdate: () => el.style.setProperty(prop, `${s.r | 0}, ${s.g | 0}, ${s.b | 0}`),
    });
  }
  const ambientTo = (rgb, d) => colorTo(root, "--amb", rgb, d);
  const lampColor = (lamp, rgb, d) => colorTo(lamp, "--c", rgb, d);

  // Tween a lamp's --on (0..1)
  function lampOn(lamp, value, vars = {}) {
    const s = lamp._on || (lamp._on = { v: parseFloat(getComputedStyle(lamp).getPropertyValue("--on")) || 0 });
    return gsap.to(s, {
      v: value, duration: 1, ease: "power2.out", ...vars,
      onUpdate: () => lamp.style.setProperty("--on", s.v.toFixed(3)),
    });
  }
  function setOn(lamp, v) {
    const s = lamp._on || (lamp._on = { v });
    s.v = v;
    lamp.style.setProperty("--on", v);
  }
  // A realistic filament flicker
  function flicker(lamp, final = 1) {
    const s = lamp._on || (lamp._on = { v: 0 });
    const tl = gsap.timeline({ onUpdate: () => lamp.style.setProperty("--on", s.v.toFixed(3)) });
    const steps = [0.55, 0.05, 0.8, 0.15, 0.35, 0.02, 0.95, 0.6, final];
    steps.forEach((v, i) => tl.to(s, { v, duration: i === steps.length - 1 ? 0.8 : 0.05 + Math.random() * 0.08, ease: "none" }));
    return tl;
  }

  /* ---------------- Cursor & light follow ---------------- */
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const smooth = { x: mouse.x, y: mouse.y };
  const dot = document.querySelector(".cursor-dot");
  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (dot) dot.style.opacity = 1;
  }, { passive: true });
  gsap.ticker.add(() => {
    smooth.x += (mouse.x - smooth.x) * 0.14;
    smooth.y += (mouse.y - smooth.y) * 0.14;
    root.style.setProperty("--mx", smooth.x + "px");
    root.style.setProperty("--my", smooth.y + "px");
    if (dot) dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
  });
  document.addEventListener("pointerover", (e) => {
    if (e.target.closest("a, button, input, .card, .product")) dot && dot.classList.add("is-hover");
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest("a, button, input, .card, .product")) dot && dot.classList.remove("is-hover");
  });

  /* ---------------- Night sky canvas ---------------- */
  const sky = document.getElementById("sky");
  const ctx = sky.getContext("2d");
  let W, H, DPR, stars = [], flies = [];
  function resizeSky() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = sky.width = innerWidth * DPR;
    H = sky.height = innerHeight * DPR;
    const n = Math.round((innerWidth * innerHeight) / 4200);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: (Math.random() * 1.1 + 0.2) * DPR,
      t: Math.random() * Math.PI * 2, s: 0.5 + Math.random() * 2, d: Math.random() * 0.6 + 0.2,
    }));
    flies = Array.from({ length: isTouch ? 12 : 20 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: (Math.random() * 1.1 + 0.6) * DPR, t: Math.random() * 10,
    }));
  }
  resizeSky();
  addEventListener("resize", resizeSky);
  let shooting = null;
  function drawSky(time) {
    const t = time / 1000;
    ctx.clearRect(0, 0, W, H);
    const scroll = (lenis ? lenis.scroll : scrollY) * 0.08 * DPR;
    const px = (smooth.x / innerWidth - 0.5) * 20 * DPR;
    const py = (smooth.y / innerHeight - 0.5) * 20 * DPR;
    for (const s of stars) {
      const a = 0.25 + 0.75 * Math.abs(Math.sin(t * s.s * 0.5 + s.t));
      let y = (s.y - scroll * s.d - py * s.d) % H; if (y < 0) y += H;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = "#e9e4ff";
      ctx.beginPath(); ctx.arc(s.x - px * s.d, y, s.r, 0, 6.283); ctx.fill();
    }
    // fireflies in the ambient colour
    const amb = getComputedStyle(root).getPropertyValue("--amb").trim() || "255,170,85";
    for (const f of flies) {
      f.t += 0.01; f.x += f.vx + Math.sin(f.t) * 0.3; f.y += f.vy + Math.cos(f.t * 0.8) * 0.3;
      if (f.x < -20) f.x = W + 20; if (f.x > W + 20) f.x = -20;
      if (f.y < -20) f.y = H + 20; if (f.y > H + 20) f.y = -20;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(f.t * 1.7));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 8);
      g.addColorStop(0, `rgba(${amb}, ${0.9 * a})`);
      g.addColorStop(1, `rgba(${amb}, 0)`);
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 8, 0, 6.283); ctx.fill();
    }
    // occasional shooting star
    if (!shooting && Math.random() < 0.003) {
      shooting = { x: Math.random() * W * 0.7 + W * 0.3, y: Math.random() * H * 0.4, l: 0 };
    }
    if (shooting) {
      shooting.l += 14 * DPR;
      const x2 = shooting.x - shooting.l, y2 = shooting.y + shooting.l * 0.45;
      const g = ctx.createLinearGradient(x2, y2, x2 + 140 * DPR, y2 - 63 * DPR);
      g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.4 * DPR; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 + 140 * DPR, y2 - 63 * DPR); ctx.stroke();
      if (shooting.l > W * 0.5) shooting = null;
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(drawSky);
  }
  requestAnimationFrame(drawSky);

  /* ---------------- Split text ---------------- */
  function splitChars(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "word";
            [...part].forEach((ch) => {
              const c = document.createElement("span");
              c.className = "char"; c.textContent = ch; w.appendChild(c);
            });
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
      });
    };
    walk(el);
    return el.querySelectorAll(".char");
  }
  function splitWords(el) {
    const walk = (node, isEm) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w" + (isEm ? " em" : ""); w.textContent = part;
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child, isEm || child.tagName === "EM");
      });
    };
    walk(el, false);
    return el.querySelectorAll(".w");
  }

  document.querySelectorAll(".split").forEach((el) => {
    const chars = splitChars(el);
    gsap.set(chars, { yPercent: 115, rotate: 6 });
    if (el.classList.contains("hero-title")) return; // played by the hero intro
    ScrollTrigger.create({
      trigger: el, start: "top 85%", once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1.1, ease: "expo.out", stagger: 0.022 }),
    });
  });

  // generic fade-up reveals (not the hero ones)
  gsap.utils.toArray(".reveal-up").forEach((el) => {
    if (el.closest(".hero")) { gsap.set(el, { y: 30, opacity: 0 }); return; }
    gsap.from(el, {
      y: 50, opacity: 0, filter: "blur(6px)", duration: 1.1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  /* ---------------- INTRO ---------------- */
  const intro = document.getElementById("intro");
  const introLamp = intro.querySelector(".intro-lamp");
  const cord = intro.querySelector(".cord");
  const cordKnob = intro.querySelector(".cord-knob");
  const heroLamp = document.querySelector(".hero-lamp");
  let switched = false;

  const loader = { v: 0 };
  const introTl = gsap.timeline();
  introTl
    .to(loader, {
      v: 100, duration: reduced ? 0.3 : 2.2, ease: "power2.inOut",
      onUpdate: () => {
        intro.querySelector(".intro-count").textContent = Math.round(loader.v);
        intro.querySelector(".intro-bar i").style.transform = `scaleX(${loader.v / 100})`;
      },
    })
    .to(".intro-loader", { opacity: 0, y: -30, filter: "blur(10px)", duration: 0.7, ease: "power2.in" })
    .set(".intro-stage", { visibility: "visible" })
    .to(".intro-stage", { opacity: 1, duration: 0.6 })
    .from(introLamp, { y: 60, opacity: 0, duration: 1.2, ease: "expo.out" }, "<")
    .from(cord, { yPercent: -100, duration: 1.4, ease: "elastic.out(1, 0.45)" }, "<0.2")
    .from(".intro-brand span", { y: 40, opacity: 0, stagger: 0.08, duration: 1, ease: "expo.out" }, "<0.2")
    .from(".intro-hint", { opacity: 0, y: 10, duration: 0.8 }, "<0.5")
    .add(() => { // a gentle "breathing" glimmer to invite the pull
      flicker(introLamp, 0).timeScale(1.6);
    }, "+=0.4");

  // Pulling the cord (drag or click)
  let dragStart = null, pulled = 0;
  cord.addEventListener("pointerdown", (e) => {
    if (switched) return;
    dragStart = e.clientY; pulled = 0;
    cord.setPointerCapture(e.pointerId);
  });
  cord.addEventListener("pointermove", (e) => {
    if (dragStart === null) return;
    pulled = Math.max(0, Math.min(90, e.clientY - dragStart));
    gsap.set(cord, { y: pulled });
  });
  const release = () => {
    if (dragStart === null) return;
    dragStart = null;
    switchOn(pulled);
  };
  cord.addEventListener("pointerup", release);
  cord.addEventListener("pointercancel", release);
  cord.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchOn(0); } });
  addEventListener("keydown", (e) => { if (e.key === "Enter" && !switched && introTl.progress() > 0.5) switchOn(0); });
  introLamp.addEventListener("click", () => switchOn(0));

  function clickSound() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const len = ac.sampleRate * 0.04;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      const src = ac.createBufferSource(); src.buffer = buf;
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500;
      const g = ac.createGain(); g.gain.value = 0.5;
      src.connect(hp).connect(g).connect(ac.destination); src.start();
      // soft warm hum as the light comes on
      const o = ac.createOscillator(); const og = ac.createGain();
      o.type = "sine"; o.frequency.value = 110;
      og.gain.setValueAtTime(0, ac.currentTime + 0.1);
      og.gain.linearRampToValueAtTime(0.04, ac.currentTime + 0.5);
      og.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 2.2);
      o.connect(og).connect(ac.destination); o.start(); o.stop(ac.currentTime + 2.3);
    } catch (_) { /* audio unavailable */ }
  }

  function switchOn(pullAmount) {
    if (switched || introTl.progress() < 0.5) return;
    switched = true;
    introTl.progress(1);
    clickSound();

    const tl = gsap.timeline();
    tl.to(cord, { y: Math.max(pullAmount, 60), duration: 0.15, ease: "power2.in" })
      .to(cord, { y: 0, duration: 1.2, ease: "elastic.out(1.1, 0.3)" })
      .add(flicker(introLamp, 1), 0.12)
      .add(() => intro.classList.add("is-on"), 0.5)
      .to(".intro-hint", { opacity: 0, duration: 0.4 }, 0.3)
      .to(".intro-brand span", { letterSpacing: "0.1em", stagger: 0.03, duration: 1, ease: "expo.out" }, 0.6)
      .to(introLamp, { scale: 1.08, duration: 1.4, ease: "power2.out" }, 0.8)
      .to(".intro-flash", { opacity: 1, scale: 3, duration: 1.1, ease: "power2.in" }, 1.6)
      .add(() => {
        body.classList.remove("is-loading");
        window.scrollTo(0, 0);
        if (lenis) lenis.start();
        heroIn();
      }, 2.5)
      .to(intro, { opacity: 0, duration: 1.2, ease: "power2.out", onComplete: () => { intro.remove(); ScrollTrigger.refresh(); } }, 2.5);
  }

  /* ---------------- HERO ---------------- */
  function heroIn() {
    gsap.set(root, { "--amb-on": 0 });
    gsap.to(root, { "--amb-on": 1, duration: 3, ease: "power2.out" });
    setOn(heroLamp, 1);
    const tl = gsap.timeline();
    tl.from(".hero-visual", { scale: 0.85, opacity: 0, duration: 1.8, ease: "expo.out" })
      .to(".hero-title .char", { yPercent: 0, rotate: 0, duration: 1.3, ease: "expo.out", stagger: 0.025 }, 0.2)
      .to(".hero .reveal-up", { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", stagger: 0.12 }, 0.5)
      .from(".nav", { y: -40, opacity: 0, duration: 1, ease: "power3.out" }, 0.6)
      .from(".scroll-cue", { opacity: 0, duration: 1 }, 1.2)
      .from(".orbit", { scale: 0.4, opacity: 0, duration: 2, ease: "expo.out", stagger: 0.2 }, 0.3);
  }
  if (!heroLamp) return;
  setOn(heroLamp, 0);

  // floating lamp + mouse parallax
  gsap.to(heroLamp, { y: -18, duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1 });
  if (!isTouch) {
    const qx = gsap.quickTo(heroLamp, "x", { duration: 1.2, ease: "power3" });
    const qr = gsap.quickTo(heroLamp, "rotate", { duration: 1.2, ease: "power3" });
    addEventListener("pointermove", (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      qx(nx * 30); qr(nx * 4);
    });
  }

  // hero scroll parallax
  gsap.to(".hero-visual", {
    yPercent: 25, scale: 0.9, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero-copy", {
    yPercent: -20, opacity: 0, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "20% top", end: "bottom top", scrub: true },
  });
  gsap.to(".scroll-cue", {
    opacity: 0, scrollTrigger: { trigger: ".hero", start: "top top", end: "15% top", scrub: true },
  });

  // nav background
  ScrollTrigger.create({
    start: 60, end: "max",
    onToggle: (self) => document.querySelector(".nav").classList.toggle("is-scrolled", self.isActive),
  });

  // marquee speed reacts to scroll velocity
  const mq = document.querySelector(".marquee-track");
  ScrollTrigger.create({
    trigger: ".marquee", start: "top bottom", end: "bottom top",
    onUpdate: (self) => {
      const v = gsap.utils.clamp(-6, 6, self.getVelocity() / 300);
      gsap.to(mq, { skewX: -v, duration: 0.4, overwrite: true });
    },
  });

  /* ---------------- Statement (word-by-word light up) ---------------- */
  const words = splitWords(document.querySelector(".statement-text"));
  gsap.to(words, {
    opacity: 1, stagger: 0.1, ease: "none",
    textShadow: "0 0 24px rgba(255, 200, 140, .35)",
    scrollTrigger: { trigger: ".statement", start: "top 75%", end: "bottom 60%", scrub: 1 },
  });

  /* ---------------- MOODS (pinned colour story) ---------------- */
  const moodLamp = document.querySelector(".mood-lamp");
  const moodTexts = gsap.utils.toArray(".mood-text");
  const moodDots = gsap.utils.toArray(".mood-dots li");
  const moodColors = [COLORS.ember, COLORS.honey, COLORS.moon, COLORS.aurora, COLORS.rose];
  let moodIndex = -1;
  lampColor(moodLamp, moodColors[0], 0.01);
  function setMood(i) {
    if (i === moodIndex) return;
    moodIndex = i;
    moodTexts.forEach((t, k) => t.classList.toggle("is-active", k === i));
    moodDots.forEach((d, k) => d.classList.toggle("is-active", k === i));
    lampColor(moodLamp, moodColors[i], 1);
    ambientTo(moodColors[i], 1.2);
    // a little "switch" pulse
    gsap.fromTo(moodLamp, { scale: 0.96 }, { scale: 1, duration: 0.9, ease: "elastic.out(1, 0.5)" });
  }
  ScrollTrigger.create({
    trigger: ".moods", start: "top top", end: "+=" + innerHeight * 4,
    pin: ".moods-pin", scrub: true, anticipatePin: 1,
    onUpdate: (self) => {
      setMood(Math.min(4, Math.floor(self.progress * 5)));
      document.querySelector(".mood-progress i").style.transform = `scaleX(${self.progress})`;
    },
    onEnter: () => { moodIndex = -1; setMood(0); },
    onEnterBack: () => { moodIndex = -1; setMood(4); },
    onLeave: () => ambientTo(userColor, 1.4),
    onLeaveBack: () => ambientTo(userColor, 1.4),
  });
  gsap.fromTo(moodLamp, { rotate: -8 }, {
    rotate: 8, ease: "none",
    scrollTrigger: { trigger: ".moods", start: "top top", end: "+=" + innerHeight * 4, scrub: true },
  });
  gsap.from(".moods-pin > *", {
    y: 80, opacity: 0, stagger: 0.15, duration: 1.2, ease: "power3.out",
    scrollTrigger: { trigger: ".moods", start: "top 70%" },
  });

  /* ---------------- FLASHLIGHT ---------------- */
  const fl = document.querySelector(".flashlight");
  const flState = { x: 50, y: 50, r: 0 };
  const applyFl = () => {
    fl.style.setProperty("--fx", flState.x + "%");
    fl.style.setProperty("--fy", flState.y + "%");
    fl.style.setProperty("--fr", flState.r + "px");
  };
  let wander = null;
  ScrollTrigger.create({
    trigger: fl, start: "top 60%", end: "bottom 40%",
    onEnter: () => gsap.to(flState, { r: isTouch ? 200 : 260, duration: 1.4, ease: "power3.out", onUpdate: applyFl }),
    onEnterBack: () => gsap.to(flState, { r: isTouch ? 200 : 260, duration: 1.4, ease: "power3.out", onUpdate: applyFl }),
    onLeave: () => gsap.to(flState, { r: 0, duration: 0.8, onUpdate: applyFl }),
    onLeaveBack: () => gsap.to(flState, { r: 0, duration: 0.8, onUpdate: applyFl }),
  });
  fl.addEventListener("pointermove", (e) => {
    if (wander) { wander.kill(); wander = null; }
    const b = fl.getBoundingClientRect();
    gsap.to(flState, {
      x: ((e.clientX - b.left) / b.width) * 100,
      y: ((e.clientY - b.top) / b.height) * 100,
      duration: 0.6, ease: "power3.out", onUpdate: applyFl,
    });
    gsap.to(".flashlight-hint", { opacity: 0, duration: 0.6 });
  });
  if (isTouch) { // drift the beam automatically on touch screens
    const path = [[20, 25], [75, 18], [80, 65], [15, 72], [50, 50], [45, 85], [38, 12]];
    wander = gsap.timeline({ repeat: -1 });
    path.forEach(([x, y]) => wander.to(flState, { x, y, duration: 1.8, ease: "sine.inOut", onUpdate: applyFl }));
  }

  /* ---------------- FEATURES ---------------- */
  const cards = gsap.utils.toArray(".card");
  gsap.from(cards, {
    y: 100, opacity: 0, rotateX: -25, transformOrigin: "50% 100%",
    duration: 1.2, ease: "expo.out", stagger: { each: 0.1, grid: "auto", from: "start" },
    scrollTrigger: { trigger: ".feature-grid", start: "top 80%" },
  });
  if (!isTouch) cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      card.style.setProperty("--px", x * 100 + "%");
      card.style.setProperty("--py", y * 100 + "%");
      gsap.to(card, { rotateY: (x - 0.5) * 14, rotateX: (0.5 - y) * 14, duration: 0.5, ease: "power2.out" });
    });
    card.addEventListener("pointerleave", () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.4)" }));
  });

  /* ---------------- STUDIO ---------------- */
  const studioLamp = document.querySelector(".studio-lamp");
  const swatches = document.querySelectorAll(".swatch");
  const swName = document.querySelector(".swatch-name");
  const range = document.getElementById("brightness");
  const out = document.getElementById("brightOut");
  const breathe = document.getElementById("breathe");
  lampColor(studioLamp, userColor, 0.01);
  swatches.forEach((sw) => sw.addEventListener("click", () => {
    swatches.forEach((s) => { s.classList.remove("is-active"); s.setAttribute("aria-checked", "false"); });
    sw.classList.add("is-active"); sw.setAttribute("aria-checked", "true");
    userColor = sw.style.getPropertyValue("--s").split(",").map(Number);
    lampColor(studioLamp, userColor, 1);
    ambientTo(userColor, 1.2);
    gsap.fromTo(swName, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 });
    swName.textContent = sw.dataset.name;
    gsap.fromTo(studioLamp, { scale: 0.95 }, { scale: 1, duration: 1, ease: "elastic.out(1, 0.4)" });
  }));
  range.addEventListener("input", () => {
    const v = range.value / 100;
    out.textContent = range.value + "%";
    range.style.setProperty("--val", range.value + "%");
    lampOn(studioLamp, v, { duration: 0.4 });
  });
  breathe.addEventListener("click", () => {
    const on = breathe.getAttribute("aria-pressed") !== "true";
    breathe.setAttribute("aria-pressed", on);
    studioLamp.classList.toggle("is-breathing", on);
  });
  setOn(studioLamp, 0);
  ScrollTrigger.create({
    trigger: ".studio", start: "top 60%", once: true,
    onEnter: () => flicker(studioLamp, range.value / 100),
  });
  gsap.from(".studio-visual", {
    x: -80, opacity: 0, duration: 1.4, ease: "expo.out",
    scrollTrigger: { trigger: ".studio", start: "top 75%" },
  });

  /* ---------------- COLLECTION (horizontal scroll) ---------------- */
  const track = document.querySelector(".collection-track");
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const hTween = gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: ".collection", start: "top top", end: () => "+=" + dist(),
      pin: ".collection-pin", scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
    },
  });
  gsap.utils.toArray(".product").forEach((p) => {
    gsap.from(p.querySelector(".mini"), {
      scale: 0.4, opacity: 0, rotate: -20, duration: 1, ease: "back.out(1.6)",
      scrollTrigger: { trigger: p, containerAnimation: hTween, start: "left 95%" },
    });
  });
  gsap.from(".collection-head > *", {
    y: 60, opacity: 0, stagger: 0.12, duration: 1.2, ease: "expo.out",
    scrollTrigger: { trigger: ".collection", start: "top 70%" },
  });

  /* ---------------- NUMBERS ---------------- */
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || 0, 10);
    const suf = el.dataset.suffix || "";
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 85%", once: true,
      onEnter: () => gsap.to(o, {
        v: end, duration: 2.2, ease: "power3.out",
        onUpdate: () => (el.textContent = o.v.toFixed(dec) + suf),
      }),
    });
  });
  gsap.from(".stat", {
    y: 50, opacity: 0, stagger: 0.12, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: ".numbers", start: "top 80%" },
  });

  /* ---------------- REVIEWS ---------------- */
  gsap.from(".review-row", {
    x: (i) => (i ? 200 : -200), opacity: 0, duration: 1.4, ease: "expo.out",
    scrollTrigger: { trigger: ".review-rows", start: "top 85%" },
  });

  /* ---------------- CTA (lamp turns on as you arrive) ---------------- */
  const ctaLamp = document.querySelector(".cta-lamp");
  setOn(ctaLamp, 0);
  const ctaState = { v: 0 };
  gsap.timeline({
    scrollTrigger: { trigger: ".cta", start: "top 80%", end: "center center", scrub: 1 },
  })
    .to(ctaState, { v: 1, ease: "power1.in", onUpdate: () => ctaLamp.style.setProperty("--on", ctaState.v.toFixed(3)) })
    .to(".cta-glow", { opacity: 1, ease: "none" }, 0)
    .from(ctaLamp, { y: -120, ease: "none" }, 0);
  gsap.from(".cta .muted, .cta .btn", {
    y: 40, opacity: 0, stagger: 0.15, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: ".cta-title", start: "top 80%" },
  });
  const ctaChars = splitChars(document.querySelector(".cta-title"));
  gsap.from(ctaChars, {
    opacity: 0, filter: "blur(12px)", y: 30, stagger: 0.03, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: ".cta-title", start: "top 80%" },
  });

  /* ---------------- Magnetic buttons ---------------- */
  if (!isTouch) document.querySelectorAll(".btn, .switch, .logo").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.4, duration: 0.4, ease: "power3.out" });
    });
    b.addEventListener("pointerleave", () => gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.35)" }));
  });

  /* ---------------- Lights on/off switch ---------------- */
  const sw = document.getElementById("lightsSwitch");
  sw.addEventListener("click", () => {
    const on = sw.getAttribute("aria-pressed") !== "true";
    sw.setAttribute("aria-pressed", on);
    sw.querySelector(".switch-label").textContent = on ? "Lights on" : "Lights off";
    body.classList.toggle("lights-off", !on);
    clickSound();
  });

  addEventListener("load", () => ScrollTrigger.refresh());
})();
