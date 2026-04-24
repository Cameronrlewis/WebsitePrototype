// Adaptive cursor: real-time bg luminance under pointer
(function() {
  var lastX = -1, lastY = -1;

  function getEffectiveBg(el) {
    while (el && el !== document.documentElement) {
      var bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      el = el.parentElement;
    }
    // fallback: check body
    var bodyBg = window.getComputedStyle(document.body).backgroundColor;
    if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') return bodyBg;
    return 'rgb(250,250,248)';
  }

  function isLight(rgb) {
    var m = rgb.match(/[\d.]+/g);
    if (!m || m.length < 3) return true;
    var r = parseInt(m[0]) / 255, g = parseInt(m[1]) / 255, b = parseInt(m[2]) / 255;
    // gamma-correct luminance
    function lin(c) { return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
    var L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.18;
  }

  function updateCursor(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return;
    if (el.closest && el.closest('.modal-img')) {
      document.documentElement.setAttribute('data-cursor-dark', '');
      return;
    }
    var bg = getEffectiveBg(el);
    if (isLight(bg)) {
      document.documentElement.removeAttribute('data-cursor-dark');
    } else {
      document.documentElement.setAttribute('data-cursor-dark', '');
    }
  }

  var raf = null;
  document.addEventListener('mousemove', function(e) {
    lastX = e.clientX; lastY = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(function() {
      raf = null;
      updateCursor(lastX, lastY);
    });
  }, { passive: true });

  // re-evaluate on scroll (section might change under stationary cursor)
  window.addEventListener('scroll', function() {
    if (lastX < 0) return;
    if (raf) return;
    raf = requestAnimationFrame(function() {
      raf = null;
      updateCursor(lastX, lastY);
    });
  }, { passive: true });
})();
