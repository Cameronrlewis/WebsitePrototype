history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

  const typedStrings = ['Electrical Engineering Student'];
  let tStr = 0, tChar = 0, tDel = false;
  const typedEl = document.getElementById('typed-text');
  function typeNext() {
    var cur = typedStrings[tStr];
    if (!tDel && tChar < cur.length) { typedEl.textContent = cur.slice(0, ++tChar); setTimeout(typeNext, 60); }
    else if (!tDel && tChar === cur.length) { setTimeout(function(){ tDel = true; typeNext(); }, 1800); }
    else if (tDel && tChar > 0) { typedEl.textContent = cur.slice(0, --tChar); setTimeout(typeNext, 30); }
    else { tDel = false; tStr = (tStr + 1) % typedStrings.length; setTimeout(typeNext, 300); }
  }
  typeNext();

  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sectionIds = ['about','skills','projects','education','contact'];
  window.addEventListener('scroll', function() {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    var active = '';
    for (var i = 0; i < sectionIds.length; i++) {
      var el = document.getElementById(sectionIds[i]);
      if (el && window.scrollY >= el.offsetTop - 130) active = sectionIds[i];
    }
    navLinks.forEach(function(a) { a.classList.toggle('active', a.getAttribute('href') === '#' + active); });
  }, { passive: true });

  function smoothScroll(e, id) { e && e.preventDefault(); document.getElementById(id).scrollIntoView({ behavior: 'smooth' }); }

  // Single shared IntersectionObserver for all reveal animations
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(function(el) { observer.observe(el); });

  function renderSkills(tab) {
    var c = document.getElementById('skills-container'); c.innerHTML = '';
    skillSets[tab].forEach(function(s, i) {
      var el = document.createElement('span'); el.className = 'skill-pill'; el.textContent = s;
      el.style.animationDelay = (0.05 + i * 0.08) + 's'; c.appendChild(el);
      requestAnimationFrame(function() { el.classList.add('visible'); });
    });
  }
  function renderSoftSkills() {
    var c = document.getElementById('soft-skills-container'); c.innerHTML = '';
    softSkills.forEach(function(s, i) {
      var el = document.createElement('span'); el.className = 'skill-pill'; el.textContent = s;
      el.style.animationDelay = (0.4 + i * 0.07) + 's'; c.appendChild(el);
      requestAnimationFrame(function() { el.classList.add('visible'); });
    });
  }
  function switchTab(btn, tab) {
    document.querySelectorAll('.skill-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active'); renderSkills(tab);
  }
  renderSkills('electrical'); renderSoftSkills();


  // ── HOVER PREVIEW (desktop only) ──
  const HOVER_OPEN_DELAY = 650;
  const HOVER_CLOSE_DELAY = 150;
  let hoverTimer = null;
  let hoverHideTimer = null;
  let hoverPreview = null;
  let currentHoverProject = null;
  let currentHoverCard = null;

  function showHoverPreview(p, cardEl) {
    if (!hoverPreview) hoverPreview = document.getElementById('hover-preview');
    var icons = {'PCB Design':'&#128268;','Signal Processing':'&#128202;','IoT / Power':'&#127760;','Power Electronics':'&#9889;'};
    var icon = p.icon || icons[p.category] || '&#129302;';
    var mediaEl = document.getElementById('hp-img');
    var mediaHeight = p.hoverMediaHeight || 400;
    mediaEl.classList.remove('has-image');
    mediaEl.style.height = mediaHeight + 'px';
    mediaEl.style.background = '';
    var previewImg = p.hoverImg || p.cardImg || p.bannerImg;
    if (previewImg) {
      var previewContain = Boolean(p.hoverContain || p.cardContain);
      var img = document.createElement('img');
      img.src = previewImg;
      img.alt = p.title;
      img.style.cssText = 'width:100%;height:100%;display:block;object-fit:' + (previewContain ? 'contain' : 'cover')
        + ';object-position:' + (p.hoverImgPosition || p.cardImgPosition || 'center')
        + ';transform:' + ((p.hoverScale || p.cardScale) ? 'scale(' + (p.hoverScale || p.cardScale) + ')' : 'none')
        + ';transform-origin:center;';
      mediaEl.replaceChildren(img);
      mediaEl.classList.add('has-image');
      mediaEl.style.background = p.hoverBackground || (previewContain
        ? 'linear-gradient(to bottom,#C9C9E3,#686882)'
        : 'linear-gradient(135deg, #3a5a4a, #2a3a30)');
    } else {
      mediaEl.innerHTML = icon;
    }
    document.getElementById('hp-cat').textContent = p.category;
    document.getElementById('hp-title').textContent = p.title;
    document.getElementById('hp-desc').textContent = p.description;
    document.getElementById('hp-tags').innerHTML = p.tags.map(function(t){ return '<span class="hover-preview-tag">'+t+'</span>'; }).join('');
    var st = document.getElementById('hp-status');
    if (p.status) {
      st.textContent = p.status === 'in-progress' ? 'In Progress' : 'Completed';
      st.className = 'hover-preview-status ' + p.status;
      st.style.display = 'inline-block';
    } else {
      st.style.display = 'none';
    }

    var previewW = Math.min(p.hoverPreviewWidth || 980, window.innerWidth * 0.9);
    hoverPreview.style.width = previewW + 'px';
    var previewH = hoverPreview.offsetHeight || p.hoverPreviewHeight || 620;
    var rect = cardEl.getBoundingClientRect();

    // Card center in viewport
    var cardCX = rect.left + rect.width / 2;
    var cardCY = rect.top + rect.height / 2;

    // Center preview in viewport
    var left = Math.round(window.innerWidth / 2 - previewW / 2);
    var top = Math.round(window.innerHeight / 2 - previewH / 2);
    if (top < 12) top = 12;
    if (top + previewH > window.innerHeight - 12) top = window.innerHeight - previewH - 12;

    // transform-origin: point on the preview that aligns with the card center
    var originX = Math.max(0, Math.min(previewW, cardCX - left));
    var originY = Math.max(0, Math.min(previewH, cardCY - top));
    hoverPreview.style.setProperty('--origin-x', originX + 'px');
    hoverPreview.style.setProperty('--origin-y', originY + 'px');
    hoverPreview.style.left = left + 'px';
    hoverPreview.style.top = top + 'px';
    hoverPreview.classList.add('visible');
  }

  function hideHoverPreview() {
    clearTimeout(hoverTimer);
    clearTimeout(hoverHideTimer);
    hoverTimer = null;
    hoverHideTimer = null;
    if (!hoverPreview) return;
    hoverPreview.classList.remove('visible');
    currentHoverProject = null;
    currentHoverCard = null;
  }

  function scheduleHoverPreview(card, p) {
    clearTimeout(hoverTimer);
    clearTimeout(hoverHideTimer);
    hoverHideTimer = null;
    currentHoverProject = p;
    currentHoverCard = card;
    hoverTimer = setTimeout(function() {
      hoverTimer = null;
      if (currentHoverProject === p && currentHoverCard === card && card.matches(':hover')) {
        showHoverPreview(p, card);
      }
    }, HOVER_OPEN_DELAY);
  }

  function attachHoverListeners(card, p) {
    if ('ontouchstart' in window) return;
    card.addEventListener('mouseenter', function() {
      scheduleHoverPreview(card, p);
    });
    card.addEventListener('mousemove', function() {
      if (!hoverPreview || !hoverPreview.classList.contains('visible')) {
        if (currentHoverCard !== card || !hoverTimer) scheduleHoverPreview(card, p);
      }
    });
    card.addEventListener('mouseleave', function() {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      clearTimeout(hoverHideTimer);
      hoverHideTimer = setTimeout(function() {
        hoverHideTimer = null;
        if (!card.matches(':hover') && (!hoverPreview || !hoverPreview.matches(':hover'))) hideHoverPreview();
      }, HOVER_CLOSE_DELAY);
    });
  }

  // DOM already loaded since script is at bottom of body
  hoverPreview = document.getElementById('hover-preview');
  if (hoverPreview) {
    hoverPreview.addEventListener('mouseenter', function() {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    });
    hoverPreview.addEventListener('mouseleave', hideHoverPreview);
    hoverPreview.addEventListener('click', function() {
      var p = currentHoverProject;
      hideHoverPreview();
      if (p) openModal(p);
    });
  }

  // Category icon map (shared between renderProjects and hover preview)
  const categoryIcons = {'PCB Design':'&#128268;','Signal Processing':'&#128202;','IoT / Power':'&#127760;','Power Electronics':'&#9889;'};

  let showAll = false;
  const projectsGrid = document.getElementById('projects-grid');
  function renderProjects() {
    projectsGrid.innerHTML = '';
    var list = showAll ? projects : projects.filter(function(p) { return p.featured; });
    list.forEach(function(p, i) {
      var icon = p.icon || categoryIcons[p.category] || '&#129302;';
      var card = document.createElement('div'); card.className = 'project-card reveal';
      card.style.transitionDelay = (0.1 + i * 0.08) + 's';
      var imgContent = p.cardImg
        ? '<img src="'+p.cardImg+'" style="width:100%;height:100%;object-fit:'+(p.cardContain?'contain':'cover')+';object-position:'+(p.cardImgPosition||'center')+';position:absolute;inset:0;background:'+(p.cardContain?'linear-gradient(to bottom,#C9C9E3,#686882)':'transparent')+';transform:'+(p.cardScale?'scale('+p.cardScale+')':'none')+';transform-origin:center;" />'
        : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:40px;">'+icon+'</div>';
      card.innerHTML = '<div class="project-img">'+imgContent+(p.status?'<span class="status-badge '+p.status+'">'+(p.status==='in-progress'?'In Progress':'Completed')+'</span>':'')+'</div><div class="project-content"><div class="project-title">'+p.title+'</div><div class="project-desc">'+p.description+'</div><div class="project-tags">'+p.tags.map(function(t){return '<span class="project-tag">'+t+'</span>';}).join('')+'</div><div class="project-hint">Click for details</div></div>';
      card.onclick = function() { openModal(p); }; projectsGrid.appendChild(card);
      attachHoverListeners(card, p);
      // Reuse the shared observer instead of creating a new one per card
      observer.observe(card);
    });
  }
  function toggleProjects(btn) { showAll = !showAll; btn.innerHTML = (showAll ? 'Show Featured' : 'View All Projects') + ' <span>&#8250;</span>'; renderProjects(); }
  renderProjects();

  // Cache modal DOM references
  var modalOverlay = document.getElementById('modal-overlay');
  var modalEl = document.getElementById('modal');
  var modalCat = document.getElementById('modal-cat');
  var modalStatusBadge = document.getElementById('modal-status-badge');
  var modalTitle = document.getElementById('modal-title');
  var modalDesc = document.getElementById('modal-desc');
  var modalDesignDecisions = document.getElementById('modal-design-decisions');
  var modalDesignDecisionsTitle = document.getElementById('modal-design-decisions-title');
  var modalChallenges = document.getElementById('modal-challenges');
  var modalTakeaways = document.getElementById('modal-takeaways');
  var modalTags = document.getElementById('modal-tags');
  var modalImg = document.getElementById('modal-img');
  var modalLinks = document.getElementById('modal-links');
  var v3dPreview = document.getElementById('v3d-preview');
  var v3dViewerTitle = document.getElementById('v3d-viewer-title');
  var currentModalProject = null;

function openModal(p) {
    currentModalProject = p;
    var c = categoryColors[p.category] || categoryColors['Embedded Systems'];
    modalEl.classList.toggle('modal-no-banner', !p.bannerImg);
    modalCat.textContent = p.category;
    if (p.status) {
      modalStatusBadge.textContent = p.status === 'in-progress' ? 'In Progress' : 'Completed';
      modalStatusBadge.className = 'modal-status-badge ' + p.status;
      modalStatusBadge.style.display = 'inline-block';
    } else {
      modalStatusBadge.style.display = 'none';
    }
    modalTitle.textContent = p.title;
    modalDesc.textContent = p.description;
    if (p.designDecisions) {
      modalDesignDecisions.textContent = p.designDecisions;
      modalDesignDecisionsTitle.style.display = '';
      modalDesignDecisions.style.display = '';
    } else {
      modalDesignDecisionsTitle.style.display = 'none';
      modalDesignDecisions.style.display = 'none';
    }
    modalChallenges.textContent = p.challenges;
    modalTakeaways.textContent = p.takeaways;
    modalTags.innerHTML = p.tags.map(function(t){return '<span class="modal-tag">'+t+'</span>';}).join('');
    modalImg.style.background = p.bannerImg ? '#e8e8e8' : 'linear-gradient(135deg,'+c.color+'60,'+c.color+'20)';
    modalImg.src = p.bannerImg || '';
    var linksHtml = '';
    if (p.reportAsset) {
      linksHtml += '<button onclick="document.getElementById(\'report-overlay\').classList.add(\'open\');document.body.style.overflow=\'hidden\'" class="modal-link github" style="cursor:pointer;border:none;">&#128196; View Report</button>';
    } else if (p.github) {
      linksHtml += '<a href="'+p.github+'" target="_blank" class="modal-link github">View on GitHub</a>';
    }
    if (p.demo) linksHtml += '<a href="'+p.demo+'" target="_blank" class="modal-link demo">Live Demo</a>';
    if (p.viewer3d) linksHtml += '<button onclick="openIBOM()" class="modal-link demo" style="cursor:pointer;border:none;">&#9636; View IBOM</button>';
    if (p.viewer3d && v3dViewerTitle) v3dViewerTitle.textContent = p.title + ' 3D Model';
    modalLinks.innerHTML = linksHtml;
    // Show/hide 3D preview
    stopPreviewSpin();
    if (p.viewer3d) {
      v3dPreview.style.display = 'block';
      initPreview3D();
    }
    else { v3dPreview.style.display = 'none'; }
    modalOverlay.classList.add('open'); document.body.style.overflow = 'hidden';
  }
  function closeModal(e) { if (e.target === modalOverlay) closeModalBtn(); }
  function closeModalBtn() { modalOverlay.classList.remove('open'); document.body.style.overflow = ''; document.body.style.position = ''; document.body.style.width = ''; stopPreviewSpin(); }
  // Prevent body scroll when touching outside modal content on iOS
  modalOverlay.addEventListener('touchmove', function(e) {
    if (e.target === this) e.preventDefault();
  }, { passive: false });
  modalOverlay.addEventListener('wheel', function(e) {
    if (e.target === this) e.preventDefault();
  }, { passive: false });

  var pdfOverlay = document.getElementById('pdf-overlay');
  var reportOverlay = document.getElementById('report-overlay');
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModalBtn();
      pdfOverlay.classList.remove('open');
      reportOverlay.classList.remove('open');
      close3DViewer();
      closeIBOM();
      document.body.style.overflow = '';
    }
  });
  function closeReportModal(e) {
    if (e.target === reportOverlay) {
      reportOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
  function closePdfModal(e) {
    if (e.target === pdfOverlay) {
      pdfOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function setContactFeedback(message, isError) {
    var feedback = document.getElementById('form-feedback');
    if (!feedback) return;

    if (!message) {
      feedback.textContent = '';
      feedback.classList.remove('show', 'error');
      return;
    }

    feedback.textContent = message;
    feedback.classList.add('show');
    feedback.classList.toggle('error', !!isError);
  }

  function submitForm(e) {
    e.preventDefault();

    var form = e.target;
    var submitButton = form.querySelector('.form-submit');
    var successMessage = document.getElementById('form-success');
    var isLocalPreview = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalPreview) {
      setContactFeedback('Netlify forms only submit on your deployed site. Publish or open the Netlify URL to test this form.', true);
      return;
    }

    setContactFeedback('', false);
    if (successMessage) successMessage.classList.remove('show');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.label = submitButton.dataset.label || submitButton.textContent;
      submitButton.textContent = 'Sending...';
    }

    var formData = new FormData(form);
    if (!formData.has('form-name')) {
      formData.append('form-name', form.getAttribute('name') || '');
    }

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(formData).toString()
    }).then(function(response) {
      if (!response.ok) {
        throw new Error('Contact form submission failed.');
      }

      form.reset();
      form.style.display = 'none';
      if (successMessage) successMessage.classList.add('show');
    }).catch(function() {
      setContactFeedback('Something went wrong while sending your message. Please try again from the live Netlify site in a moment.', true);
    }).finally(function() {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.label || 'Send Message';
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function() {
    var e = 'Cameronrl' + '@' + 'mun.ca';
    document.querySelectorAll('.email-link').forEach(function(a) {
      a.href = 'mailto:' + e;
    });

    var contactForm = document.getElementById('contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', submitForm);
    }
  });
