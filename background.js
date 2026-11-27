// Size the original image before clipping the viewport. Scaling a cover-sized
// background on a fixed box would permanently hide part of the source image.
export function imageLayout(canvasWidth, canvasHeight, imageWidth, imageHeight, options = {}) {
  if (![canvasWidth, canvasHeight, imageWidth, imageHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const fit = options.fit === 'contain' ? Math.min : Math.max;
  const value = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const zoom = Math.max(.25, Math.min(3, value(options.scale, 100) / 100));
  const factor = fit(canvasWidth / imageWidth, canvasHeight / imageHeight) * zoom;
  const width = imageWidth * factor, height = imageHeight * factor;
  const x = Math.max(0, Math.min(100, value(options.x, 50))) / 100;
  const y = Math.max(0, Math.min(100, value(options.y, 50))) / 100;
  return { width, height, left: (canvasWidth - width) * x, top: (canvasHeight - height) * y };
}

export function initBackground(canvas) {
  const image = canvas.querySelector('img.mist-chat-image-layer');
  let options = { url: '' };
  let active = true;
  function layout() {
    if (!active || !options.url) return;
    const box = imageLayout(canvas.clientWidth, canvas.clientHeight,
      image.naturalWidth, image.naturalHeight, options);
    if (!box) return;
    for (const [name, value] of Object.entries(box)) image.style[name] = value + 'px';
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
  observer?.observe(canvas);
  image.addEventListener('load', layout);
  window.addEventListener('resize', layout, { passive: true });
  return {
    update(next) {
      const changed = next.url !== options.url;
      options = next;
      if (changed) {
        if (next.url) image.src = next.url;
        else image.removeAttribute('src');
      }
      layout();
    },
    cleanup() {
      active = false;
      observer?.disconnect();
      image.removeEventListener('load', layout);
      window.removeEventListener('resize', layout);
    }
  };
}
