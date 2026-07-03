/* =====================================================
   ANUJ GAMBHIR — DUAL-THREAD PORTFOLIO v2
   boot · cursor · split text · morphing particle globe · pinned scenes
   ===================================================== */

(function () {
  "use strict";

  const html = document.documentElement;
  const body = document.body;
  body.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const isMobile = window.innerWidth < 720;

  const hasGSAP = typeof gsap !== "undefined";
  const hasThree = typeof THREE !== "undefined";

  if (hasGSAP) {
    if (typeof ScrollTrigger !== "undefined") gsap.registerPlugin(ScrollTrigger);
    if (typeof Flip !== "undefined") gsap.registerPlugin(Flip);
  }

  if (reduceMotion || !hasGSAP) body.classList.add("motion-off");

  /* ---------- utils ---------- */

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@+=";

  function scramble(el, duration) {
    if (reduceMotion) return;
    const original = el.getAttribute("data-original") || el.textContent;
    el.setAttribute("data-original", original);
    const len = original.length;
    const start = performance.now();
    const dur = duration || 700;
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      let out = "";
      for (let i = 0; i < len; i++) {
        const ch = original[i];
        if (ch === " " || ch === "·" || ch === "—") { out += ch; continue; }
        out += i / len < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = original;
    }
    requestAnimationFrame(frame);
  }

  function splitChars(el) {
    const text = el.textContent;
    el.textContent = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < text.length; i++) {
      const s = document.createElement("span");
      s.className = "char";
      s.textContent = text[i];
      frag.appendChild(s);
    }
    el.appendChild(frag);
    return el.querySelectorAll(".char");
  }

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (w, i) {
      const s = document.createElement("span");
      s.className = "word";
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return el.querySelectorAll(".word");
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  /* =====================================================
     THREE.JS — morphing particle field
     engineer  -> tensor globe (quantized lat/long lattice)
     strategist -> growth spiral galaxy
     ===================================================== */

  const fieldAPI = { setMode: function () {} };

  function initField() {
    const canvas = document.getElementById("field");
    if (!hasThree || reduceMotion) {
      if (canvas) canvas.style.background =
        "radial-gradient(ellipse 70% 55% at 62% 40%, rgba(140,123,255,0.12), transparent 70%)";
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 0, 13);

    const N = isMobile ? 2600 : 5200;
    const R = 4.3;
    const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle

    const latt = new Float32Array(N * 3);
    const flow = new Float32Array(N * 3);
    const phase = new Float32Array(N);

    const LAT_BANDS = 20, LON_BANDS = 40;

    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = 1 - t * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * i;

      // quantize to lat/lon grid -> structured tensor globe
      const lat = Math.asin(y);
      const lon = Math.atan2(Math.sin(th) * rad, Math.cos(th) * rad);
      const qLat = Math.round(lat / Math.PI * LAT_BANDS) / LAT_BANDS * Math.PI;
      const qLon = Math.round(lon / (Math.PI * 2) * LON_BANDS) / LON_BANDS * Math.PI * 2;
      const cr = Math.cos(qLat);
      latt[i * 3]     = Math.cos(qLon) * cr * R;
      latt[i * 3 + 1] = Math.sin(qLat) * R;
      latt[i * 3 + 2] = Math.sin(qLon) * cr * R;

      // growth spiral: expanding disc, rising with radius
      const sr = 0.6 + t * 5.6;
      const sa = i * GA * 2.0;
      flow[i * 3]     = Math.cos(sa) * sr;
      flow[i * 3 + 1] = (t - 0.5) * 2.4 + Math.sin(sa * 2.0) * 0.28;
      flow[i * 3 + 2] = Math.sin(sa) * sr;

      phase[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(latt, 3));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(flow, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));

    const uniforms = {
      uTime: { value: 0 },
      uMix: { value: 0 },
      uColorA: { value: new THREE.Color(0x8c7bff) },
      uColorB: { value: new THREE.Color(0xffb25c) },
      uSize: { value: isMobile ? 2.0 : 2.4 },
      uOpacity: { value: 1 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        "attribute vec3 aTarget;",
        "attribute float aPhase;",
        "uniform float uTime;",
        "uniform float uMix;",
        "uniform float uSize;",
        "varying float vAlpha;",
        "varying float vMix;",
        "void main() {",
        "  float m = clamp(uMix * 1.6 - aPhase * 0.6, 0.0, 1.0);",
        "  m = m * m * (3.0 - 2.0 * m);",
        "  vMix = m;",
        "  vec3 pos = mix(position, aTarget, m);",
        "  pos.x += sin(uTime * 0.5 + aPhase * 6.2831) * 0.06;",
        "  pos.y += cos(uTime * 0.4 + aPhase * 4.71) * 0.06;",
        "  pos.z += sin(uTime * 0.3 + aPhase * 3.14) * 0.06;",
        "  vec4 mv = modelViewMatrix * vec4(pos, 1.0);",
        "  float tw = 0.75 + 0.45 * sin(uTime * 1.4 + aPhase * 12.566);",
        "  gl_PointSize = uSize * tw * (24.0 / -mv.z);",
        "  vAlpha = smoothstep(30.0, 6.0, -mv.z) * (0.35 + 0.65 * tw);",
        "  gl_Position = projectionMatrix * mv;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uColorA;",
        "uniform vec3 uColorB;",
        "uniform float uOpacity;",
        "varying float vAlpha;",
        "varying float vMix;",
        "void main() {",
        "  float d = length(gl_PointCoord - 0.5);",
        "  float a = smoothstep(0.5, 0.08, d) * vAlpha * 0.9 * uOpacity;",
        "  if (a < 0.01) discard;",
        "  vec3 col = mix(uColorA, uColorB, vMix);",
        "  gl_FragColor = vec4(col, a);",
        "}",
      ].join("\n"),
    });

    const core = new THREE.Points(geo, mat);
    const coreGroup = new THREE.Group();
    coreGroup.add(core);
    coreGroup.position.x = isMobile ? 0 : 3.4;
    coreGroup.position.y = isMobile ? 2.2 : 0.2;
    if (isMobile) coreGroup.scale.setScalar(0.72);
    scene.add(coreGroup);

    // starfield backdrop
    const SN = isMobile ? 350 : 800;
    const sPos = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const r = 18 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      sPos[i * 3]     = Math.cos(a) * Math.cos(b) * r;
      sPos[i * 3 + 1] = Math.sin(b) * r * 0.6;
      sPos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r - 20;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    const sMat = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x8e89a3,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const stars = new THREE.Points(sGeo, sMat);
    scene.add(stars);

    // interaction
    let mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    let scrollFade = 1;
    window.addEventListener("scroll", function () {
      const h = window.innerHeight;
      scrollFade = Math.max(0.14, 1 - (window.scrollY / (h * 1.2)) * 0.9);
    }, { passive: true });

    const clock = new THREE.Clock();
    let raf;
    function tick() {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      uniforms.uOpacity.value += (scrollFade - uniforms.uOpacity.value) * 0.06;
      mx += (tx - mx) * 0.04;
      my += (ty - my) * 0.04;
      core.rotation.y = t * 0.1 + mx * 0.3;
      core.rotation.x = my * 0.18 + Math.sin(t * 0.15) * 0.08;
      stars.rotation.y = t * 0.008 + mx * 0.04;
      renderer.render(scene, camera);
    }
    tick();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) cancelAnimationFrame(raf);
      else { clock.getDelta(); tick(); }
    });

    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    fieldAPI.setMode = function (mode) {
      const target = mode === "strategist" ? 1 : 0;
      if (hasGSAP) {
        gsap.to(uniforms.uMix, { value: target, duration: 1.8, ease: "power3.inOut" });
        gsap.to(coreGroup.rotation, { z: target === 1 ? -0.35 : 0, duration: 1.8, ease: "power3.inOut" });
      } else {
        uniforms.uMix.value = target;
      }
    };
  }

  try { initField(); } catch (e) { console.warn("field init failed:", e); }

  /* =====================================================
     CURSOR + MAGNETIC
     ===================================================== */

  function initCursor() {
    if (isTouch || reduceMotion) return;
    const dot = document.getElementById("cursor-dot");
    const ring = document.getElementById("cursor-ring");
    if (!dot || !ring) return;

    let cx = -100, cy = -100, rx = -100, ry = -100, shown = false;

    window.addEventListener("pointermove", function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!shown) { shown = true; dot.style.opacity = 1; ring.style.opacity = 1; }
    }, { passive: true });

    (function loop() {
      requestAnimationFrame(loop);
      rx += (cx - rx) * 0.16;
      ry += (cy - ry) * 0.16;
      dot.style.transform = "translate(" + (cx - 3) + "px," + (cy - 3) + "px)";
      ring.style.transform = "translate(" + (rx - 19) + "px," + (ry - 19) + "px)";
    })();

    document.querySelectorAll("[data-hover]").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add("is-hover"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("is-hover"); });
    });

    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (hasGSAP) gsap.to(el, { x: dx * 0.22, y: dy * 0.22, duration: 0.4, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", function () {
        if (hasGSAP) gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }
  initCursor();

  /* =====================================================
     MODE SWITCH
     ===================================================== */

  const modeBtns = Array.prototype.slice.call(document.querySelectorAll("[data-set-mode]"));
  const workTrack = document.getElementById("work-track");
  const wcards = workTrack ? Array.prototype.slice.call(workTrack.querySelectorAll(".wcard")) : [];
  const moreGrid = document.querySelector(".more-grid");
  const mcards = moreGrid ? Array.prototype.slice.call(moreGrid.querySelectorAll(".mcard")) : [];
  const workNote = document.getElementById("work-note");

  function applyOrder(mode) {
    const attr = mode === "strategist" ? "data-strat" : "data-eng";
    wcards.forEach(function (c) { c.style.order = c.getAttribute(attr); });
    mcards.forEach(function (c) { c.style.order = c.getAttribute(attr); });
    wcards
      .slice()
      .sort(function (a, b) { return +a.style.order - +b.style.order; })
      .forEach(function (c, i) {
        const idx = c.querySelector(".wcard-index");
        if (idx) idx.textContent = pad2(i + 1);
      });
  }
  applyOrder("engineer");

  function setMode(mode) {
    if (html.getAttribute("data-mode") === mode) return;

    modeBtns.forEach(function (btn) {
      const active = btn.getAttribute("data-set-mode") === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    if (hasGSAP && typeof Flip !== "undefined" && !reduceMotion) {
      const state = Flip.getState(wcards.concat(mcards));
      html.setAttribute("data-mode", mode);
      applyOrder(mode);
      Flip.from(state, { duration: 0.8, ease: "power3.inOut", stagger: 0.02 });
    } else {
      html.setAttribute("data-mode", mode);
      applyOrder(mode);
    }

    if (workNote) {
      workNote.textContent = mode === "strategist"
        ? "SORTED FOR: STRATEGISTS · DRAG YOUR SCROLL"
        : "SORTED FOR: ENGINEERS · DRAG YOUR SCROLL";
      scramble(workNote, 500);
    }

    fieldAPI.setMode(mode);
  }

  modeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-set-mode")); });
  });

  /* =====================================================
     BOOT SEQUENCE
     ===================================================== */

  const boot = document.getElementById("boot");

  function killBoot() {
    if (boot) boot.classList.add("is-done");
    body.style.overflow = "";
  }

  function runBoot(onDone) {
    if (!boot || reduceMotion || !hasGSAP) { killBoot(); onDone(); return; }

    body.style.overflow = "hidden";
    const logEl = document.getElementById("boot-log");
    const pctEl = document.getElementById("boot-pct");
    const lines = [
      "> mounting /threads/engineering .... <span class='ok'>ok</span>",
      "> mounting /threads/strategy ....... <span class='ok'>ok</span>",
      "> loading tensor lattice ........... <span class='ok'>ok</span>",
      "> calibrating market curves ........ <span class='ok'>ok</span>",
      "> starting runtime ................. <span class='ok'>ok</span>",
    ];

    lines.forEach(function (l, i) {
      setTimeout(function () { logEl.innerHTML += l + "<br>"; }, 120 + i * 210);
    });

    const counter = { v: 0 };
    gsap.to(counter, {
      v: 100,
      duration: 1.55,
      ease: "power2.inOut",
      onUpdate: function () {
        pctEl.textContent = String(Math.round(counter.v)).padStart(3, "0");
      },
      onComplete: function () {
        const tl = gsap.timeline({ onComplete: function () { killBoot(); onDone(); } });
        tl.to(".boot-inner", { opacity: 0, duration: 0.3, ease: "power2.in" })
          .to(".boot-panel-l", { xPercent: -101, duration: 0.7, ease: "power4.inOut" }, 0.15)
          .to(".boot-panel-r", { xPercent: 101, duration: 0.7, ease: "power4.inOut" }, 0.15);
      },
    });

    setTimeout(function () {
      if (!boot.classList.contains("is-done")) { killBoot(); onDone(); }
    }, 5000);
  }

  /* =====================================================
     INTRO + SCROLL CHOREOGRAPHY
     ===================================================== */

  function initMotion() {
    if (!hasGSAP || reduceMotion) {
      body.classList.add("motion-off");
      return;
    }

    /* --- hero intro --- */
    const heroChars = [];
    document.querySelectorAll("[data-split]").forEach(function (el) {
      splitChars(el).forEach(function (c) { heroChars.push(c); });
    });

    const intro = gsap.timeline({ defaults: { ease: "power4.out" }, paused: true });
    intro
      .from(heroChars, { yPercent: 115, duration: 1.15, stagger: 0.035 }, 0)
      .to("[data-intro]", { opacity: 1, duration: 0.9, stagger: 0.1, ease: "power3.out" }, 0.35);

    runBoot(function () {
      intro.play();
      document.querySelectorAll("[data-scramble]").forEach(function (el) { scramble(el, 900); });
      ScrollTrigger.refresh();
    });

    /* --- reveals --- */
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });

    /* --- counters --- */
    gsap.utils.toArray("[data-count]").forEach(function (el) {
      const end = parseFloat(el.getAttribute("data-count"));
      const prefix = el.getAttribute("data-prefix") || "";
      const suffix = el.getAttribute("data-suffix") || "";
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end, duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: function () { el.textContent = prefix + Math.round(obj.v) + suffix; },
        onComplete: function () { el.textContent = prefix + end + suffix; },
      });
    });

    /* --- lede word reveal --- */
    const lede = document.getElementById("lede");
    if (lede) {
      const words = splitWords(lede);
      gsap.to(words, {
        opacity: 1,
        stagger: 0.06,
        ease: "none",
        scrollTrigger: { trigger: lede, start: "top 82%", end: "bottom 45%", scrub: 0.6 },
      });
    }

    /* --- marquees --- */
    document.querySelectorAll("[data-marquee], [data-marquee-rev]").forEach(function (track) {
      const rev = track.hasAttribute("data-marquee-rev");
      const original = track.innerHTML;
      while (track.scrollWidth < window.innerWidth * 2.2) track.innerHTML += track.innerHTML || original;
      const w = track.scrollWidth / 2;
      gsap.fromTo(track,
        { x: rev ? -w : 0 },
        { x: rev ? 0 : -w, duration: isMobile ? 30 : 44, ease: "none", repeat: -1 });
    });

    /* --- rail progress + section label --- */
    const railProgress = document.getElementById("rail-progress");
    const railSection = document.getElementById("rail-section");
    if (railProgress) {
      gsap.to(railProgress, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: body, start: "top top", end: "max", scrub: 0.3 },
      });
    }
    if (railSection) {
      gsap.utils.toArray("[data-section]").forEach(function (sec) {
        ScrollTrigger.create({
          trigger: sec,
          start: "top 55%",
          end: "bottom 55%",
          onEnter: function () { railSection.textContent = sec.getAttribute("data-section"); scramble(railSection, 420); },
          onEnterBack: function () { railSection.textContent = sec.getAttribute("data-section"); scramble(railSection, 420); },
        });
      });
    }

    /* --- desktop pinned scenes --- */
    const mm = gsap.matchMedia();

    mm.add("(min-width: 721px)", function () {

      const strat = document.getElementById("duality-strat");
      const seam = document.getElementById("duality-seam");
      if (strat && seam) {
        const dtl = gsap.timeline({
          scrollTrigger: {
            trigger: "#duality",
            start: "top top",
            end: "+=160%",
            scrub: 0.5,
            pin: "#duality-stage",
          },
        });
        dtl.fromTo(strat,
          { clipPath: "inset(0 0 0 100%)" },
          { clipPath: "inset(0 0 0 0%)", ease: "none" }, 0)
          .fromTo(seam, { left: "100%" }, { left: "0%", ease: "none" }, 0);
      }

      const track = document.getElementById("work-track");
      const pin = document.getElementById("work-pin");
      if (track && pin) {
        function dist() { return Math.max(track.scrollWidth - window.innerWidth, 0); }
        gsap.to(track, {
          x: function () { return -dist(); },
          ease: "none",
          scrollTrigger: {
            trigger: pin,
            start: "top 12%",
            end: function () { return "+=" + dist(); },
            scrub: 0.6,
            pin: true,
            invalidateOnRefresh: true,
          },
        });
      }

      return function () {};
    });

    /* --- log line draw --- */
    const log = document.querySelector(".log");
    if (log) {
      gsap.to(log, {
        "--log-draw": 1,
        ease: "none",
        scrollTrigger: { trigger: log, start: "top 80%", end: "bottom 60%", scrub: 0.5 },
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    initMotion();
  }

  if (!hasGSAP || reduceMotion) {
    killBoot();
    body.classList.add("motion-off");
  } else if (document.readyState === "complete" || document.readyState === "interactive") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
