const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const intro = document.querySelector("#intro");
const frameLayer = intro.querySelector(".intro__frame");
const receipt = document.querySelector(".promo--receipt");
const receiptContent = receipt.querySelector(".promo__content");
const clamp = (value, start = 0, end = 1) => Math.min(end, Math.max(start, value));
const smooth = (value) => value * value * (3 - 2 * value);

const frameCount = 84;
const framesPerSheet = 16;
const titleFadeEnd = 16 / (frameCount - 1);
const sheetUrls = Array.from({ length: Math.ceil(frameCount / framesPerSheet) }, (_, index) =>
  new URL(`./assets/frames/scroll-${String(index + 1).padStart(2, "0")}.jpg`, document.baseURI).href
);

let renderRequest = 0;
let currentFrame = -1;
let ready = false;
let preloadRequest;

function renderTransition() {
  renderRequest = 0;
  if (!ready || reducedMotion.matches) return;

  const stageHeight = intro.firstElementChild.offsetHeight;
  const position = intro.getBoundingClientRect();
  const distance = Math.max(1, position.height - stageHeight);
  const progress = clamp(-position.top / distance);
  const incoming = Math.max(0, receipt.getBoundingClientRect().top);
  const frame = Math.round(progress * (frameCount - 1));

  if (frame !== currentFrame) {
    const withinSheet = frame % framesPerSheet;
    frameLayer.style.backgroundImage = `url("${sheetUrls[Math.floor(frame / framesPerSheet)]}")`;
    frameLayer.style.backgroundPosition = `${(withinSheet % 4) * 100 / 3}% ${Math.floor(withinSheet / 4) * 100 / 3}%`;
    currentFrame = frame;
  }
  intro.style.setProperty("--frame-opacity", frame > 0 ? 1 : 0);
  intro.style.setProperty("--title-opacity", 1 - smooth(clamp(progress / titleFadeEnd)));
  intro.style.setProperty("--city-opacity", smooth(clamp((progress - 0.9) / 0.1)));

  const reveal = smooth(clamp((progress - 0.77) / 0.23));
  const offset = reveal * Math.min(incoming, stageHeight);
  const cityOffset = Math.min(incoming, stageHeight);
  intro.style.setProperty("--city-compensation", `${stageHeight - cityOffset}px`);
  receipt.style.setProperty("--city-position", `${-cityOffset}px`);
  receiptContent.style.transform = offset > 0 ? `translateY(${-offset}px)` : "";
  receiptContent.style.opacity = reveal;
  receiptContent.style.visibility = reveal > 0.02 ? "" : "hidden";
}

function scheduleTransition() {
  if (!renderRequest && ready && !reducedMotion.matches) {
    renderRequest = requestAnimationFrame(renderTransition);
  }
}

function syncMotionPreference() {
  const active = ready && !reducedMotion.matches;
  document.documentElement.classList.toggle("has-motion", active);
  if (active) {
    scheduleTransition();
  } else {
    intro.removeAttribute("style");
    receipt.removeAttribute("style");
    receiptContent.removeAttribute("style");
  }
  if (!reducedMotion.matches && !preloadRequest) {
    preloadRequest = Promise.all(sheetUrls.map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    })).then((images) => {
      // Retain the decoded sheets so switching direction never waits on the network.
      ready = images.length === sheetUrls.length;
      syncMotionPreference();
      return images;
    }).catch(() => []);
  }
}

reducedMotion.addEventListener("change", syncMotionPreference);
window.addEventListener("scroll", scheduleTransition, { passive: true });
window.addEventListener("resize", scheduleTransition);
syncMotionPreference();

const prizeTemplate = document.querySelector("#prizes-template");
for (const carousel of document.querySelectorAll("[data-prizes]")) {
  carousel.append(prizeTemplate.content.cloneNode(true));
  const track = carousel.querySelector(".prizes__track");
  const previous = carousel.querySelector('[data-direction="-1"]');
  const next = carousel.querySelector('[data-direction="1"]');

  function updateButtons() {
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  }

  function move(direction) {
    const [first, second] = track.children;
    const step = second.offsetLeft - first.offsetLeft;
    const index = Math.round(track.scrollLeft / step) + direction;
    track.scrollTo({ left: index * step, behavior: reducedMotion.matches ? "instant" : "smooth" });
  }

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  track.addEventListener("scroll", updateButtons, { passive: true });
  new ResizeObserver(updateButtons).observe(track);
  updateButtons();
}

const actionDialog = document.querySelector("#action-dialog");
for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", () => {
    actionDialog.querySelector("h2").textContent = (button.querySelector(".tile__link") ?? button).textContent.trim();
    actionDialog.showModal();
  });
}
