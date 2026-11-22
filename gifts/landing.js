const campaignMotion = matchMedia("(prefers-reduced-motion: reduce)");
const campaignHero = document.querySelector(".campaign-hero__scene");
const campaignFooter = document.querySelector(".campaign-footer");
const svgNamespace = "http://www.w3.org/2000/svg";
const heroDrawDuration = 1500;
const garlandLayout = {
  hero: { route: "hero", box: [0, 1, 1920, 1079], origin: [-554.488, -118.5] },
  front: { route: "page", box: [1598, 834, 322, 109], origin: [-554.488, -66.5] },
  glass: { route: "page", box: [1199, 230, 140, 85], origin: [-554.488, -66.5] },
  page: { route: "page", box: [0, 1081, 1920, 6129], origin: [-554.488, -67.5] },
  super: { route: "super", box: [0, 3488, 1920, 1092], origin: [-553.488, -67.5] },
  footer: { route: "footer", box: [0, 0, 1920, 1050], origin: [-167.5, 88.203] },
};

function svgPart(tag, attributes) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

function makeGarland(art) {
  const name = art.dataset.garland;
  const { route, box, origin } = garlandLayout[name];
  const [x, y, width, height] = box;
  const maskId = `campaign-mask-${name}`;
  const svg = svgPart("svg", { viewBox: box.join(" "), preserveAspectRatio: "none", "aria-hidden": "true" });
  svg.setAttribute("class", art.className);
  if (art.hasAttribute("style")) svg.setAttribute("style", art.getAttribute("style"));

  const path = svgPart("path", {
    d: campaignGarlandPaths[route],
    transform: `translate(${origin.join(" ")})`,
    fill: "none",
    stroke: "white",
    "stroke-width": "112",
    "stroke-linecap": "round",
  });
  const mask = svgPart("mask", { id: maskId, x, y, width, height, maskUnits: "userSpaceOnUse" });
  mask.append(path);
  const image = svgPart("image", { href: art.getAttribute("src"), x, y, width, height, preserveAspectRatio: "none", mask: `url(#${maskId})` });
  svg.append(mask, image);
  art.replaceWith(svg);

  const length = path.getTotalLength();
  return { name, path, length, route, box, origin, svg, distance: -1 };
}

function measureScrollMarkers(garland) {
  const { path, length, origin } = garland;
  const count = 300;
  const endY = path.getPointAtLength(length).y;
  let farthestY = path.getPointAtLength(0).y;
  return Array.from({ length: count + 1 }, (_, index) => {
    const distance = length * index / count;
    farthestY = Math.max(farthestY, path.getPointAtLength(distance).y);
    // Allocate some scroll to sideways turns so loops reveal continuously.
    const linearY = endY * index / count;
    return { distance, y: origin[1] + farthestY * .8 + linearY * .2 };
  });
}

function distanceAtScroll(markers, y) {
  let low = 0;
  let high = markers.length - 1;
  if (y <= markers[low].y) return 0;
  if (y >= markers[high].y) return markers[high].distance;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (markers[middle].y <= y) low = middle;
    else high = middle;
  }
  const fraction = (y - markers[low].y) / (markers[high].y - markers[low].y);
  return markers[low].distance + fraction * (markers[high].distance - markers[low].distance);
}

function visiblePathRange(garland, [x, y, width, height] = garland.box) {
  const distances = Array.from({ length: 501 }, (_, index) => garland.length * index / 500);
  const visibleDistances = distances.filter(distance => {
    const point = garland.path.getPointAtLength(distance);
    const worldX = point.x + garland.origin[0];
    const worldY = point.y + garland.origin[1];
    return worldX >= x - 56 && worldX <= x + width + 56 && worldY >= y - 56 && worldY <= y + height + 56;
  });
  return [visibleDistances[0] ?? 0, visibleDistances.at(-1) ?? garland.length];
}

const garlandArtwork = [...document.querySelectorAll("img[data-garland]")];
const heroArtwork = garlandArtwork.filter(art => ["hero", "front", "glass"].includes(art.dataset.garland));
let heroDrawFinished = campaignMotion.matches || !["", "#top"].includes(location.hash);
let heroDrawStart;
const heroArtworkReady = heroDrawFinished ? null : Promise.allSettled(heroArtwork.map(art => art.decode()));
const heroRanges = new Map();
const scrollGarlands = garlandArtwork.map(art => {
  const garland = makeGarland(art);
  if (heroArtwork.includes(art)) heroRanges.set(garland, visiblePathRange(garland, [0, 0, 1920, 1080]));
  return garland;
});
const pageGarlandMarkers = measureScrollMarkers(scrollGarlands.find(garland => garland.name === "page"));
const orbGarland = scrollGarlands.find(garland => garland.route === "super");
const [orbPathStart, orbPathEnd] = visiblePathRange(orbGarland);
let garlandFrame = 0;

function revealGarlands(now = performance.now()) {
  garlandFrame = 0;
  const hero = campaignHero.getBoundingClientRect();
  if (campaignMotion.matches || hero.bottom <= 0) heroDrawFinished = true;
  const heroProgress = heroDrawFinished ? 1 : Math.min(1, (now - (heroDrawStart ?? now)) / heroDrawDuration);
  if (heroProgress === 1) heroDrawFinished = true;
  const scrollLine = (innerHeight * .74 - hero.top) * 1920 / hero.width;
  const footerTop = campaignFooter.getBoundingClientRect().top;
  const footerProgress = Math.max(0, Math.min(1, (innerHeight * .8 - footerTop) / (innerHeight * .74)));
  const orb = orbGarland.svg.getBoundingClientRect();
  const orbProgress = Math.max(0, Math.min(1, (innerHeight * .88 - orb.top) / (orb.height + innerHeight * .22)));
  const distances = {
    page: distanceAtScroll(pageGarlandMarkers, scrollLine),
    super: orbPathStart + (orbPathEnd - orbPathStart) * orbProgress,
  };
  for (const garland of scrollGarlands) {
    const heroRange = heroRanges.get(garland);
    const distance = Math.round(campaignMotion.matches ? garland.length
      : heroRange ? heroRange[0] + (heroRange[1] - heroRange[0]) * heroProgress
      : garland.route === "footer" ? garland.length * footerProgress
      : distances[garland.route]);
    if (distance === garland.distance) continue;
    garland.path.style.opacity = distance > 0 && (!heroRange || heroProgress > 0) ? 1 : 0;
    garland.path.style.strokeDasharray = `${distance} ${garland.length + 112}`;
    garland.distance = distance;
  }
  if (!heroDrawFinished && heroDrawStart !== undefined) scheduleGarlandReveal();
}

function scheduleGarlandReveal() {
  if (!garlandFrame) garlandFrame = requestAnimationFrame(revealGarlands);
}

window.addEventListener("scroll", scheduleGarlandReveal, { passive: true });
window.addEventListener("resize", scheduleGarlandReveal);
campaignMotion.addEventListener("change", scheduleGarlandReveal);
revealGarlands();
heroArtworkReady?.then(() => {
  heroDrawStart = performance.now();
  scheduleGarlandReveal();
});

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
