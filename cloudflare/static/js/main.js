/* =========================================================================
   Steinwerk — Demo-Muster
   Vanilla JS, kein Framework, keine Abhängigkeiten.
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sticky-Header-Zustand ---------- */
  var header = document.getElementById('header');

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile-Navigation ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  /* ---------- Scroll-Reveal ---------- */
  var revealables = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Referenz-Filter ---------- */
  var filters = document.querySelectorAll('.filters .chip');
  var projects = document.querySelectorAll('#gallery .project');

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wanted = btn.dataset.filter;

      filters.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      projects.forEach(function (p) {
        var show = wanted === 'alle' || p.dataset.cat === wanted;
        p.classList.toggle('is-hidden', !show);
      });
    });
  });

  /* ---------- Vorher / Nachher-Vergleich ---------- */
  var baFrame = document.getElementById('baFrame');
  var baBefore = document.getElementById('baBefore');
  var baDivider = document.getElementById('baDivider');

  if (baFrame && baBefore && baDivider) {
    var dragging = false;

    function setPosition(clientX) {
      var rect = baFrame.getBoundingClientRect();
      var pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(2, Math.min(98, pct));
      baBefore.style.width = pct + '%';
      baDivider.style.left = pct + '%';
    }

    function onDown(e) {
      dragging = true;
      setPosition(e.touches ? e.touches[0].clientX : e.clientX);
    }

    function onMove(e) {
      if (!dragging) return;
      if (e.touches) e.preventDefault();
      setPosition(e.touches ? e.touches[0].clientX : e.clientX);
    }

    function onUp() { dragging = false; }

    baFrame.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    baFrame.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    // Tastaturbedienung
    baFrame.setAttribute('tabindex', '0');
    baFrame.setAttribute('role', 'slider');
    baFrame.setAttribute('aria-label', 'Vorher-Nachher-Vergleich');
    baFrame.setAttribute('aria-valuemin', '0');
    baFrame.setAttribute('aria-valuemax', '100');
    baFrame.setAttribute('aria-valuenow', '50');

    baFrame.addEventListener('keydown', function (e) {
      var current = parseFloat(baBefore.style.width) || 50;
      var step = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPositionByValue(current - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPositionByValue(current + step);
      } else if (e.key === 'Home') {
        e.preventDefault(); setPositionByValue(2);
      } else if (e.key === 'End') {
        e.preventDefault(); setPositionByValue(98);
      }
    });

    function setPositionByValue(pct) {
      pct = Math.max(2, Math.min(98, pct));
      baBefore.style.width = pct + '%';
      baDivider.style.left = pct + '%';
      baFrame.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  }

  /* ---------- Kontaktformular: Validierung ---------- */
  var form = document.getElementById('kontaktForm');

  if (form) {
    var success = document.getElementById('formSuccess');

    var messages = {
      name: 'Bitte nennen Sie uns Ihren Namen.',
      tel: 'Bitte geben Sie eine Telefonnummer an, unter der wir Sie erreichen.',
      mail: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
      vorhaben: 'Bitte wählen Sie die Art Ihres Vorhabens.',
      nachricht: 'Bitte beschreiben Sie Ihr Vorhaben kurz (mind. 10 Zeichen).',
      dsgvo: 'Bitte bestätigen Sie die Datenschutzerklärung.'
    };

    function fieldOf(input) { return input.closest('.field'); }

    function validate(input) {
      var value = (input.value || '').trim();
      var error = '';

      if (input.type === 'checkbox') {
        if (!input.checked) error = messages[input.name];
      } else if (input.hasAttribute('required') && !value) {
        error = messages[input.name] || 'Dieses Feld ist erforderlich.';
      } else if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        error = messages.mail;
      } else if (input.name === 'tel' && value && !/^[\d\s+()\/-]{6,}$/.test(value)) {
        error = 'Diese Telefonnummer sieht nicht gültig aus.';
      } else if (input.name === 'nachricht' && value && value.length < 10) {
        error = messages.nachricht;
      }

      var field = fieldOf(input);
      var slot = field ? field.querySelector('[data-error-for="' + input.name + '"]') : null;

      if (field) field.classList.toggle('has-error', Boolean(error));
      if (slot) slot.textContent = error;
      input.setAttribute('aria-invalid', error ? 'true' : 'false');

      return !error;
    }

    var controls = Array.prototype.slice.call(
      form.querySelectorAll('input, select, textarea')
    );

    controls.forEach(function (input) {
      input.addEventListener('blur', function () { validate(input); });
      input.addEventListener('input', function () {
        var field = fieldOf(input);
        if (field && field.classList.contains('has-error')) validate(input);
      });
      input.addEventListener('change', function () { validate(input); });
    });

    function showFieldError(name, text) {
      var field = form.querySelector('[data-error-for="' + name + '"]');
      if (field) field.textContent = text;
      var input = form.querySelector('[name="' + name + '"]');
      if (input && input.closest('.field')) input.closest('.field').classList.add('has-error');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      controls.forEach(function (i) { if (i.closest('.field')) i.closest('.field').classList.remove('has-error'); });

      var firstInvalid = null;
      controls.forEach(function (input) {
        if (!validate(input) && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var payload = {
        name:    byName('name'),
        tel:     byName('tel'),
        mail:    byName('mail'),
        vorhaben: byName('vorhaben'),
        nachricht: byName('nachricht'),
        firma:   byName('firma'),
        sms:     byName('sms') === 'on'
      };

      function byName(n) {
        var el = form.querySelector('[name="' + n + '"]');
        if (!el) return '';
        return el.type === 'checkbox' ? (el.checked ? 'on' : '') : el.value.trim();
      }

      btn.disabled = true;
      btn.textContent = 'Wird gesendet …';
      if (success) success.hidden = true;

      fetch(form.action || '/api/anfrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().then(function (d) { return { status: r.status, data: d }; });
        })
        .then(function (res) {
          if (res.status === 200 && res.data.ok) {
            form.reset();
            controls.forEach(function (i) { i.removeAttribute('aria-invalid'); });
            if (success) {
              success.hidden = false;
              success.innerHTML =
                '<strong>Vielen Dank — Anfrage ist eingegangen.</strong>' +
                '<p>Ihre Referenz: <b>' + res.data.id + '</b>. Wir melden uns innerhalb von 24 Stunden ' +
                'mit einer konkreten Terminwoche bei Ihnen.</p>';
            }
            return;
          }

          // Server hat abgelehnt — Felder markieren
          var errs = res.data.errors || {};
          var keys = Object.keys(errs);
          if (!keys.length) keys = ['_all'];

          keys.forEach(function (k) {
            if (k === '_all') {
              var btn2 = form.querySelector('button[type="submit"]');
              btn2.textContent = errs._all;
              return;
            }
            showFieldError(k, errs[k]);
          });

          var target = form.querySelector('.has-error input, .has-error select, .has-error textarea');
          if (target) target.focus();
        })
        .catch(function () {
          btn.textContent = 'Server nicht erreichbar';
        })
        .finally(function () {
          btn.disabled = false;
          window.setTimeout(function () { btn.textContent = 'Angebot kostenlos anfordern'; }, 2600);
        });
    });
  }
})();
