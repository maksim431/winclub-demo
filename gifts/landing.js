const campaignMotion = matchMedia("(prefers-reduced-motion: reduce)");
const scrollGarlands = [...document.querySelectorAll("[data-scroll-garland]")];
let garlandFrame = 0;

function revealGarlands() {
  garlandFrame = 0;
  for (const garland of scrollGarlands) {
    if (campaignMotion.matches) {
      garland.style.removeProperty("--garland-hidden");
      continue;
    }
    const { top, height } = garland.getBoundingClientRect();
    const visibleFraction = Math.max(0, Math.min(1, (innerHeight * .88 - top) / height));
    garland.style.setProperty("--garland-hidden", `${(1 - visibleFraction) * 100}%`);
  }
}

function scheduleGarlandReveal() {
  if (!garlandFrame) garlandFrame = requestAnimationFrame(revealGarlands);
}

window.addEventListener("scroll", scheduleGarlandReveal, { passive: true });
window.addEventListener("resize", scheduleGarlandReveal);
campaignMotion.addEventListener("change", scheduleGarlandReveal);
revealGarlands();

for (const carousel of document.querySelectorAll("[data-campaign-carousel]")) {
  const track = carousel.querySelector(".campaign-carousel");
  const previous = carousel.querySelector('[data-direction="-1"]');
  const next = carousel.querySelector('[data-direction="1"]');

  function syncControls() {
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  }

  function slide(direction) {
    const [first, second] = track.children;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    const end = track.scrollWidth - track.clientWidth;
    const index = Math.round(track.scrollLeft / step);
    const left = direction === 1 && step > end ? end : (index + direction) * step;
    track.scrollTo({ left, behavior: campaignMotion.matches ? "instant" : "smooth" });
  }

  previous.addEventListener("click", () => slide(-1));
  next.addEventListener("click", () => slide(1));
  track.addEventListener("scroll", syncControls, { passive: true });
  new ResizeObserver(syncControls).observe(track);
  syncControls();
}
