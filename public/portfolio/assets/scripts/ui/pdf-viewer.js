// PDF Viewer using PDF.js
(function() {
  var pdfDoc = null;
  var currentPage = 1;
  var totalPages = 0;
  var currentScale = 1.5;
  var fitScale = 1.5;
  var canvas = null;
  var ctx = null;
  var rendering = false;
  var pendingPage = null;
  var PDF_URL = './assets/documents/resume/cameron-lewis-resume.pdf';

  function renderPage(num) {
    if (rendering) { pendingPage = num; return; }
    rendering = true;
    pdfDoc.getPage(num).then(function(page) {
      var dpr = window.devicePixelRatio || 1;
      var viewport = page.getViewport({ scale: currentScale });
      // Set canvas pixel dimensions at device resolution for sharp rendering
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      // Set CSS display size to logical dimensions so layout is unchanged
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var renderContext = { canvasContext: ctx, viewport: viewport };
      page.render(renderContext).promise.then(function() {
        rendering = false;
        if (pendingPage !== null) {
          var p = pendingPage;
          pendingPage = null;
          renderPage(p);
        }
      });
    });
    document.getElementById('pdf-page-info').textContent = num + ' / ' + totalPages;
    document.getElementById('pdf-zoom-level').textContent = Math.round(currentScale / fitScale * 100) + '%';
  }

  function calcFitScale(page) {
    var viewer = document.getElementById('pdf-render-viewer');
    var viewerWidth = viewer.clientWidth - 40;
    var unscaledViewport = page.getViewport({ scale: 1 });
    return viewerWidth / unscaledViewport.width;
  }

  window.initPdfViewer = function() {
    canvas = document.getElementById('pdf-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    if (typeof pdfjsLib === 'undefined') return;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    pdfjsLib.getDocument(PDF_URL).promise.then(function(pdf) {
      pdfDoc = pdf;
      totalPages = pdf.numPages;

      var pageControls = document.getElementById('pdf-page-controls');
      if (totalPages > 1) {
        pageControls.style.display = 'flex';
      } else {
        pageControls.style.display = 'none';
      }

      // Calculate fit-to-width scale
      pdf.getPage(1).then(function(page) {
        fitScale = calcFitScale(page);
        currentScale = fitScale;
        renderPage(1);
      });
    });

    // Zoom controls
    document.getElementById('pdf-zoom-in').onclick = function() {
      currentScale = Math.min(currentScale + fitScale * 0.25, fitScale * 3);
      renderPage(currentPage);
    };
    document.getElementById('pdf-zoom-out').onclick = function() {
      currentScale = Math.max(currentScale - fitScale * 0.25, fitScale * 0.5);
      renderPage(currentPage);
    };
    document.getElementById('pdf-zoom-fit').onclick = function() {
      if (!pdfDoc) return;
      pdfDoc.getPage(currentPage).then(function(page) {
        fitScale = calcFitScale(page);
        currentScale = fitScale;
        renderPage(currentPage);
      });
    };

    // Page controls
    document.getElementById('pdf-page-prev').onclick = function() {
      if (currentPage <= 1) return;
      currentPage--;
      renderPage(currentPage);
    };
    document.getElementById('pdf-page-next').onclick = function() {
      if (currentPage >= totalPages) return;
      currentPage++;
      renderPage(currentPage);
    };
  };

  window.destroyPdfViewer = function() {
    if (pdfDoc) {
      pdfDoc.destroy();
      pdfDoc = null;
    }
    currentPage = 1;
    totalPages = 0;
    currentScale = 1.5;
    rendering = false;
    pendingPage = null;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  // Hook into the existing resume button open logic
  var origOpen = document.getElementById('pdf-overlay');
  if (origOpen) {
    var obs = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'class' && origOpen.classList.contains('open') && !pdfDoc) {
          initPdfViewer();
        }
      });
    });
    obs.observe(origOpen, { attributes: true });
  }
})();
