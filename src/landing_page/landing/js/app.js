/* ==========================================================================
   RAAHAT v3 — app.js (highway/signage redesign)
   Instrument bar · mile-marker rail · live demo console · no fabrication
   ========================================================================== */
(function () {
  'use strict';

  var API = '/api/v1';
  var HEALTH_POLL_MS = 30000;
  var NAV_H = 64;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var statusFirstDone = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function fmtDistance(m) {
    if (m == null || isNaN(m)) return '—';
    if (m < 1000) return Math.round(m) + 'M';
    return (m / 1000).toFixed(m < 10000 ? 2 : 1) + 'KM';
  }
  function fmtDuration(sec) {
    if (sec == null || isNaN(sec)) return '—';
    var m = Math.max(1, Math.round(sec / 60));
    return m + 'MIN';
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function catLabel(cat) { return (cat || 'OTHER').replace(/_/g, ' '); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('is-open');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('is-open'); }, 2600);
  }

  /* ---------------- Mask-reveal hero (§0.6) ---------------- */
  function initRevealLines() {
    requestAnimationFrame(function () {
      document.body.classList.add('is-loaded');
    });
  }

  /* ---------------- Scroll reveal (quiet fade + 4px rise) ---------------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (reducedMotion || !('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------------- Nav solidify ---------------- */
  function initNav() {
    var nav = $('#nav');
    var onScroll = function () { nav.classList.toggle('nav--solid', window.scrollY > 40); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------- Mile-marker rail (§0.5) ---------------- */
  function initRail() {
    var fill = $('#railFill');
    var top = $('#progressTop');
    var railH = function () { return Math.max(1, window.innerHeight - NAV_H); };
    var update = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? h.scrollTop / max : 0;
      if (fill) fill.style.height = (p * railH()) + 'px';
      if (top) top.style.width = (p * 100) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // active shield highlight
    var shields = Array.prototype.slice.call(document.querySelectorAll('.shield'));
    var sections = shields.map(function (s) { return s.closest('section, header'); }).filter(Boolean);
    if ('IntersectionObserver' in window && !reducedMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var sh = e.target.querySelector('.shield');
          if (!sh) return;
          if (e.isIntersecting) { shields.forEach(function (x) { x.classList.remove('is-active'); }); sh.classList.add('is-active'); }
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------------- Instrument bar (§3.2 / health §2) ---------------- */
  function svcClass(v) { return v === 'ok' ? 'ok' : (v && v !== 'ok') ? 'amber' : 'red'; }

  function renderInstrument(data, latency, ok) {
    var strip = $('#instrument');
    var sysLabel = $('#sysLabel');
    var svcList = $('#svcList');
    var sysLat = $('#sysLat');
    strip.classList.remove('is-down');

    if (!ok || !data) {
      strip.classList.add('is-down');
      sysLabel.textContent = 'SERVICE CHECK FAILED';
      svcList.innerHTML = '<span class="svc"><span class="d red"></span>api unreachable</span>';
      sysLat.innerHTML = 'LAT <b class="mono">' + Math.round(latency) + ' MS</b>';
      return;
    }
    var status = data.status;
    var services = data.services || {};
    var keys = ['database', 'google', 'rag', 'llm'];
    var allOk = keys.every(function (k) { return services[k] === 'ok'; });
    var anyMissing = keys.some(function (k) { return !(k in services); });

    if (status !== 'ok' || !allOk || anyMissing) strip.classList.add('is-down');
    sysLabel.textContent = (allOk && status === 'ok') ? 'SYSTEM LIVE' : (status === 'ok' ? 'SERVICES DEGRADED' : 'SERVICES DOWN');

    svcList.innerHTML = keys.map(function (k) {
      var st = svcClass(services[k]);
      return '<span class="svc"><span class="d ' + st + '"></span>' + k + '</span>';
    }).join('<span style="color:var(--asphalt-line)">·</span>');

    sysLat.innerHTML = 'LAT <b class="mono">' + Math.round(latency) + ' MS</b>';
  }

  function pingHealth() {
    var t0 = performance.now();
    fetch(API + '/health', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (body) {
        var lat = performance.now() - t0;
        var data = (body && body.success && body.data) ? body.data : null;
        renderInstrument(data, lat, !!data);
      })
      .catch(function () { renderInstrument(null, performance.now() - t0, false); });
  }
  function initStatus() { pingHealth(); setInterval(pingHealth, HEALTH_POLL_MS); }

  /* ---------------- Geolocation ---------------- */
  var DEMO_LOC = { latitude: 22.7196, longitude: 75.8577 };
  var currentLoc = null;
  function initGeolocation() {
    var locEl = $('#demoLoc');
    if (!('geolocation' in navigator)) { setFallback(locEl); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        currentLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_meters: Math.round(pos.coords.accuracy || 0) };
        locEl.textContent = pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4);
      },
      function () { setFallback(locEl); },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }
  function setFallback(locEl) {
    currentLoc = { latitude: DEMO_LOC.latitude, longitude: DEMO_LOC.longitude, accuracy_meters: 10 };
    locEl.innerHTML = '<span class="pin">📍 DEMO INDORE (22.7196, 75.8577)</span>';
  }

  /* ---------------- Demo ---------------- */
  var INCIDENT_ICO = { ACCIDENT: '🚗💥', TYRE_PUNCTURE: '🛞', VEHICLE_BREAKDOWN: '🔧', VEHICLE_FIRE: '🔥', MEDICAL_EMERGENCY: '🚑', STRANDED: '🌙', FUEL_EMERGENCY: '⛽', OTHER: '⚠️' };
  var ERR_COPY = {
    VALIDATION_ERROR: 'That message couldn’t be validated — try rephrasing.',
    INVALID_COORDINATES: 'Your coordinates couldn’t be used. Allow location access.',
    UNSUPPORTED_LANGUAGE: 'That language isn’t supported yet. Try English or Hindi.',
    NO_SERVICES_FOUND: 'No nearby services were found for this situation.',
    GOOGLE_PLACES_ERROR: 'The live places provider returned an error.',
    RAG_UNAVAILABLE: 'The guidance knowledge base is temporarily unavailable.',
    LLM_UNAVAILABLE: 'The AI model is temporarily unavailable.',
    RATE_LIMITED: 'Too many requests — wait a moment and retry.',
    INTERNAL_ERROR: 'Something went wrong on the server.'
  };

  var demoForm, demoInput, demoStage, lastRequest = null;

  function initDemo() {
    demoForm = $('#demoForm'); demoInput = $('#demoInput'); demoStage = $('#demoStage');
    Array.prototype.forEach.call(document.querySelectorAll('#demoChips .chip'), function (chip) {
      chip.addEventListener('click', function () {
        demoInput.value = chip.getAttribute('data-text');
        demoInput.focus();
        demoInput.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      });
    });
    demoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = (demoInput.value || '').trim();
      if (!msg) { demoInput.focus(); return; }
      runDemo(msg);
    });
  }

  function buildPayload(message) {
    return {
      message: message, language: 'en',
      location: { latitude: currentLoc.latitude, longitude: currentLoc.longitude, accuracy_meters: currentLoc.accuracy_meters != null ? currentLoc.accuracy_meters : 10, timestamp: new Date().toISOString() },
      network_mode: 'ONLINE', include_services: true, max_services: 5,
      session_id: lastRequest ? lastRequest.session_id : ('sess_' + Math.random().toString(36).slice(2, 10))
    };
  }

  function setStage(html) {
    demoStage.style.opacity = '0';
    setTimeout(function () {
      demoStage.innerHTML = html;
      demoStage.style.opacity = '1';
    }, reducedMotion ? 0 : 170);
  }

  function showSkeleton() {
    setStage(
      '<div class="skel-panel"><div class="skel skel-l" style="width:40%"></div><div class="skel skel-l" style="width:90%;height:18px"></div><div class="skel skel-l" style="width:70%"></div></div>' +
      '<div class="skel-panel"><div class="skel skel-l" style="width:55%"></div><div class="skel skel-l" style="width:92%"></div><div class="skel skel-l" style="width:75%"></div></div>' +
      '<div class="skel-panel"><div class="skel skel-l" style="width:60%"></div><div class="skel skel-l" style="width:88%"></div></div>'
    );
  }

  function showError(code, message) {
    var copy = ERR_COPY[code] || 'An unexpected error occurred.';
    setStage(
      '<div class="err">' +
      '<div class="err__code">ERROR ' + escapeHtml(code || 'ERROR') + '</div>' +
      '<div class="err__msg">' + escapeHtml(message || copy) + '</div>' +
      '<div class="caption" style="color:var(--on-asphalt-faint);margin-top:6px">// ' + escapeHtml(copy) + '</div>' +
      '<div class="err__retry"><button class="btn btn--outline btn--sm" id="errRetry" style="border-color:var(--on-asphalt);color:var(--on-asphalt)">Retry</button></div>' +
      '</div>'
    );
    $('#demoCaption').style.display = 'none';
    var btn = $('#errRetry'); if (btn && lastRequest) btn.addEventListener('click', function () { runDemo(lastRequest.message, true); });
  }

  function runDemo(message, isRetry) {
    var payload = buildPayload(message);
    lastRequest = { message: message, session_id: payload.session_id };
    $('#demoSession').textContent = 'SESS ' + payload.session_id;
    setSubmitting(true);
    showSkeleton();

    var t0 = performance.now();
    fetch(API + '/emergency-assistance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
      .then(function (res) {
        var latency = Math.round(performance.now() - t0);
        setSubmitting(false);
        var body = res.body || {};
        if (body.success === false || !body.data) { var e = body.error || {}; showError(e.code || 'INTERNAL_ERROR', e.message || 'Request failed.'); return; }
        renderResults(body.data, latency);
      })
      .catch(function () { setSubmitting(false); showError('INTERNAL_ERROR', 'Network request failed — the API may be unreachable.'); });
  }

  function setSubmitting(on) { var b = $('#demoSubmit'); b.disabled = on; b.textContent = on ? 'Working…' : 'Get help'; }

  function renderResults(data, latency) {
    var html =
      '<div class="results">' +
      renderIncident(data.incident) +
      renderGuidance(data.guidance) +
      renderServices(data.services || [], latency, data.recommended_actions || []) +
      '</div>';
    setStage(html);
    $('#demoCaption').style.display = '';
  }

  function panel(label, inner) {
    return '<div class="panel"><div class="panel__label"><span class="b"></span>' + label + '</div>' + inner + '</div>';
  }

  function renderIncident(inc) {
    var type = (inc && inc.incident_type) || 'OTHER';
    var sev = (inc && inc.severity) || 'UNKNOWN';
    var conf = (inc && inc.confidence != null) ? inc.confidence : null;
    var inner =
      '<div class="inc">' +
        '<div class="inc__type">' + (INCIDENT_ICO[type] || '⚠️') + ' ' + escapeHtml(catLabel(type)) + '</div>' +
        '<span class="sev sev-' + sev + '">' + sev + '</span>' +
        '<div class="conf"><div class="conf__val mono">' + (conf != null ? Math.round(conf * 100) + '%' : '—') + '</div><div class="conf__lbl">confidence</div>' +
          (conf != null ? '<div class="conf__bar"><i style="width:' + Math.round(conf * 100) + '%"></i></div>' : '') + '</div>' +
        (inc && inc.summary ? '<div class="inc__sum">' + escapeHtml(inc.summary) + '</div>' : '') +
      '</div>';
    return panel('Incident classification', inner);
  }

  function renderGuidance(g) {
    if (!g) return '';
    var steps = (g.steps || []).map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('');
    var safety = g.safety_note ? '<div class="guide__safety"><b>⚠ Safety</b><span>' + escapeHtml(g.safety_note) + '</span></div>' : '';
    var inner = '<div class="guide__title">' + escapeHtml(g.title || 'Guidance') + '</div><ol class="guide__steps">' + steps + '</ol>' + safety;
    return panel('What to do right now', inner);
  }

  function renderServices(services, latency, actions) {
    if (!services || !services.length) return panel('Nearest services', '<p class="body" style="color:var(--ink-faint)">No services returned for this situation.</p>');
    var tickets = services.map(function (svc, i) { return renderTicket(svc, i, actions, latency); }).join('');
    return panel('Nearest services · ranked as returned (unmodified)', '<div>' + tickets + '</div>');
  }

  function renderTicket(svc, idx, actions, latency) {
    var myActions = (actions || []).filter(function (a) { return !a.service_id || a.service_id === svc.service_id; });
    var liveCls = svc.is_cached ? 'is-cached' : '';
    var liveTxt = svc.is_cached ? 'CACHED' : 'LIVE';
    var syncTxt = svc.is_cached ? (', SYNCED ' + fmtDateTime(svc.retrieved_at)) : '';

    // availability — NEVER fabricate (§2)
    var avail;
    if (svc.is_open === true && svc.availability_status !== 'UNKNOWN') avail = '<span style="color:var(--go)">Open now</span>';
    else if (svc.is_open === false) avail = '<span style="color:var(--hazard)">Closed</span>';
    else avail = '<span style="color:var(--ink-faint)">Availability unknown</span>';

    // reason — backend-owned ranking (§2)
    var reason = 'Recommended because it is a suitable ' + catLabel(svc.category).toLowerCase() + ' service and is ' + (svc.distance_meters < 1000 ? Math.round(svc.distance_meters) + 'm' : (svc.distance_meters / 1000).toFixed(2) + 'km') + ' away.';

    // actions — confirmation where requires_confirmation (§2)
    var acts = '';
    if (svc.phone) {
      var needsConfirm = myActions.some(function (a) { return (a.type === 'CALL' || a.type === 'CONTACT_PROVIDER') && a.requires_confirmation; });
      if (needsConfirm) {
        acts += '<button class="btn btn--outline" type="button" id="call_' + idx + '">📞 Call</button>';
      } else {
        acts += '<a class="btn btn--outline" href="tel:' + escapeHtml(svc.phone) + '">📞 Call</a>';
      }
    }
    acts += '<a class="btn btn--route" href="https://www.google.com/maps/search/?api=1&query=' + svc.location.latitude + ',' + svc.location.longitude + '" target="_blank" rel="noopener">🧭 Navigate</a>';

    var h =
      '<div class="ticket">' +
        '<div><div class="ticket__name">' + escapeHtml(svc.name || 'Unnamed service') + '</div>' +
        '<div class="ticket__cat">' + escapeHtml(svc.category || 'OTHER') + '</div></div>' +
        (idx === 0 ? '<span class="ticket__rank">#1</span>' : '<span></span>') +
        '<div class="ticket__data">' +
          '<span class="k">DIST</span> <span class="v">' + fmtDistance(svc.distance_meters) + '</span> · ' +
          '<span class="k">ETA</span> <span class="v">' + fmtDuration(svc.estimated_duration_seconds) + '</span>' +
          (svc.rating != null ? ' · <span class="k">RATING</span> <span class="v">' + Number(svc.rating).toFixed(1) + '</span>' : '') +
          ' · <span class="src-readout ' + liveCls + '">SOURCE ' + escapeHtml(svc.source || 'UNKNOWN') + ' · ' + liveTxt + syncTxt + '</span>' +
        '</div>' +
        '<div class="ticket__avail">AVAILABILITY → ' + avail + '</div>' +
        '<div class="ticket__reason">' + escapeHtml(reason) + '</div>' +
        '<div class="ticket__acts">' + acts + '</div>' +
        '<div class="ticket__datasrc">' +
          '<span>SYNCED <b class="mono">' + escapeHtml(fmtDateTime(svc.retrieved_at)) + '</b></span>' +
          '<span>LATENCY <b class="mono">' + latency + ' MS</b></span>' +
        '</div>' +
      '</div>';

    // wire confirmation if needed (after insertion)
    if (svc.phone && myActions.some(function (a) { return (a.type === 'CALL' || a.type === 'CONTACT_PROVIDER') && a.requires_confirmation; })) {
      setTimeout(function () {
        var b = document.getElementById('call_' + idx);
        if (b) b.addEventListener('click', function () {
          confirmAction('Call ' + (svc.name || 'provider') + '?', 'RAAHAT will place a call to ' + svc.phone + '. This shares your situation with the provider. Continue?', function () { window.location.href = 'tel:' + svc.phone; });
        });
      }, 0);
    }
    return h;
  }

  /* ---------------- Confirm modal ---------------- */
  var modalCb = null;
  function confirmAction(title, body, cb) {
    $('#modalTitle').textContent = title;
    $('#modalBody').textContent = body;
    modalCb = cb;
    $('#modal').classList.add('is-open');
  }
  function initModal() {
    var m = $('#modal');
    $('#modalCancel').addEventListener('click', function () { m.classList.remove('is-open'); modalCb = null; });
    $('#modalConfirm').addEventListener('click', function () { m.classList.remove('is-open'); var cb = modalCb; modalCb = null; if (cb) { cb(); toast('// action confirmed'); } });
    m.addEventListener('click', function (e) { if (e.target === m) { m.classList.remove('is-open'); modalCb = null; } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { m.classList.remove('is-open'); modalCb = null; } });
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initRevealLines();
    initNav();
    initRail();
    initReveal();
    initStatus();
    initGeolocation();
    initDemo();
    initModal();
  });
})();
