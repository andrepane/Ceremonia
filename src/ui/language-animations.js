import { refs } from "../state.js";

const MAX_PETALS = 14;
const LOW_END_MAX_PETALS = 8;
const PETAL_TONES = [
  "linear-gradient(145deg, rgba(255, 240, 233, 0.96), rgba(243, 198, 194, 0.9) 52%, rgba(233, 178, 174, 0.82))",
  "linear-gradient(145deg, rgba(255, 245, 236, 0.95), rgba(244, 214, 191, 0.88) 53%, rgba(224, 184, 152, 0.78))",
  "linear-gradient(145deg, rgba(255, 236, 236, 0.96), rgba(237, 199, 207, 0.9) 50%, rgba(220, 168, 179, 0.78))"
];

let isReducedMotion = false;
let isLowEndDevice = false;

function detectLowEndDevice() {
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  return memory <= 4 || cores <= 4;
}

function trackReducedMotion() {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    isReducedMotion = media.matches;
  };
  sync();
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", sync);
  } else if (typeof media.addListener === "function") {
    media.addListener(sync);
  }
}

function buildPetalNode() {
  const petal = document.createElement("span");
  petal.className = "petal";
  return petal;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function spawnPetal(originX, burstDuration) {
  if (!refs.petalLayer) return;
  const petal = buildPetalNode();
  const depth = random(0, 1);
  const size = random(12, 24) * (isLowEndDevice ? 0.88 : 1) * (0.8 + depth * 0.55);
  const drift = random(-82, 82);
  const startX = originX + random(-18, 18);
  const startY = random(-8, 12);
  const rotateStart = random(-25, 35);
  const rotateEnd = rotateStart + random(90, 230) * (Math.random() > 0.5 ? 1 : -1);
  const opacity = random(0.45, 0.9) * (0.78 + depth * 0.28);
  const blur = depth > 0.7 ? random(0.2, 0.6) : random(0, 0.25);
  const duration = Math.min(900, Math.max(400, burstDuration + random(-120, 140)));
  const delay = random(0, 120);
  const turbulence = random(-22, 22);
  const tone = PETAL_TONES[Math.floor(random(0, PETAL_TONES.length))];

  petal.style.setProperty("--petal-size", `${size}px`);
  petal.style.setProperty("--petal-opacity", `${opacity}`);
  petal.style.setProperty("--petal-blur", `${blur}px`);
  petal.style.setProperty("--petal-x-start", `${startX}px`);
  petal.style.setProperty("--petal-y-start", `${startY}px`);
  petal.style.setProperty("--petal-x-end", `${startX + drift}px`);
  petal.style.setProperty("--petal-y-end", `${startY + random(90, 148)}px`);
  petal.style.setProperty("--petal-turbulence", `${turbulence}px`);
  petal.style.setProperty("--petal-r-start", `${rotateStart}deg`);
  petal.style.setProperty("--petal-r-end", `${rotateEnd}deg`);
  petal.style.setProperty("--petal-duration", `${duration}ms`);
  petal.style.setProperty("--petal-delay", `${delay}ms`);
  petal.style.background = tone;
  refs.petalLayer.appendChild(petal);

  const cleanup = () => petal.remove();
  petal.addEventListener("animationend", cleanup, { once: true });
}

export function initLanguageAnimations() {
  trackReducedMotion();
  isLowEndDevice = detectLowEndDevice();
}

export function triggerPetalBurst(targetButton) {
  if (isReducedMotion || !refs.petalLayer || !targetButton) return;
  const rect = targetButton.getBoundingClientRect();
  const stageRect = refs.petalLayer.getBoundingClientRect();
  const originX = rect.left + rect.width / 2 - stageRect.left;
  const burstDuration = isLowEndDevice ? 480 : 620;
  const petals = isLowEndDevice ? LOW_END_MAX_PETALS : MAX_PETALS;

  for (let index = 0; index < petals; index += 1) spawnPetal(originX, burstDuration);
}
