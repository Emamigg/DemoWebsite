/* =========================================================================
   Konfigurator — Preisrichtwert und Live-Vorschau
   Vanilla JS, kein Framework, keine Abhängigkeiten.
   ========================================================================= */
(function () {
  'use strict';

  var STUNDENSATZ = 75;
  var NEBENKOSTEN = 7.00;
  var RECHTSTEXT = 118.00;
  var GRUNDSTD = 25;

  var BASIS = [
    { id: 'basis-konzeption', name: 'Konzeption, Beratung, Zielgruppe', std: 3 },
    { id: 'basis-design', name: 'Seitengestaltung, Design, Bildwelt', std: 10 },
    { id: 'basis-aufbau', name: 'Aufbau Website, 5 Unterseiten', std: 12 }
  ];

  var MODULE = [
    { gruppe: 'Startseite', id: 'hero', name: 'Startseite mit Festpreis-Versprechen', std: 3, an: true },
    { gruppe: 'Startseite', id: 'stats', name: 'Vertrauens-Kennzahlen als Kennzahlenband', std: 1, an: false },
    { gruppe: 'Startseite', id: 'leistungen', name: 'Leistungsübersicht', std: 3, an: true },
    { gruppe: 'Startseite', id: 'ablauf', name: 'Ablauf in vier Schritten', std: 2, an: false },
    { gruppe: 'Startseite', id: 'usp', name: 'Warum wir — Begründungsblock', std: 2, an: false },
    { gruppe: 'Startseite', id: 'bewertungen', name: 'Kundenbewertungen', std: 2, an: false },
    { gruppe: 'Startseite', id: 'faq', name: 'Häufige Fragen', std: 2, an: false },

    { gruppe: 'Beweis', id: 'galerie', name: 'Referenzgalerie mit Filter', std: 4, an: true },
    { gruppe: 'Beweis', id: 'bavorsnachher', name: 'Vorher-/Nachher-Vergleich zum Ziehen', std: 3, an: false },

    { gruppe: 'Anfragesystem', id: 'topbar', name: 'Öffnungszeiten-Topbar', std: 1, an: false },
    { gruppe: 'Anfragesystem', id: 'formular', name: 'Kontaktformular mit Anfragen-Protokoll', std: 9, an: true,
      pflicht: 'Ohne Formular erreicht Sie keine Anfrage, die Sie zuordnen können.' },
    { gruppe: 'Anfragesystem', id: 'sms', name: 'SMS-Benachrichtigung zusätzlich zur E-Mail', std: 1, an: false },
    { gruppe: 'Anfragesystem', id: 'telefoncta', name: 'Telefon-CTA am Seitenende', std: 1, an: false },

    { gruppe: 'Formalien', id: 'recht', name: 'Impressum und Datenschutzerklärung', std: 2, an: true,
      pflicht: 'Impressum ist nach § 5 DDG vorgeschrieben — ohne das kein Betriebsstart.' },
    { gruppe: 'Formalien', id: 'abnahme', name: 'Test, Abnahme, Übergabedokumentation', std: 2, an: true },
    { gruppe: 'Formalien', id: 'einweisung', name: 'Einweisung und Schulung', std: 2, an: true }
  ];

  var VORLAGEN = {
    schlank: ['hero', 'formular', 'recht', 'abnahme'],
    standard: MODULE.filter(function (m) { return m.an; }).map(function (m) { return m.id; }),
    komplett: MODULE.map(function (m) { return m.id; })
  };

  var BREITEN = { breit: null, tablet: 834, handy: 390 };

  var frame = document.getElementById('frame');
  var vorschau = document.getElementById('vorschau');
  var stand = document.getElementById('stand');
  var druckbogen = document.getElementById('druckbogen');

  var zustand = {};
  var urspruenglich = new WeakMap();

/* ---------- Preisformat ---------- */
  function euro(wert) {
    return wert.toLocaleString('de-DE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + ' €';
  }

  function summe() {
    var std = GRUNDSTD;
    var gewaehlt = [];
    MODULE.forEach(function (m) {
      if (zustand[m.id]) { std += m.std; gewaehlt.push(m); }
    });
    return { std: std, leistung: std * STUNDENSATZ, gewaehlt: gewaehlt };
  }

  /* ---------- Ziele in der Vorschau ---------- */
  function doc() { return frame && frame.contentDocument ? frame.contentDocument : null; }

  function sandAbschnitte() {
    var d = doc();
    if (!d) return [];
    return Array.prototype.filter.call(
      d.querySelectorAll('section.section--sand'),
      function (el) { return !el.id; }
    );
  }

  function feldVonSms() {
    var d = doc();
    if (!d) return [];
    var opt = d.querySelector('#kontakt .check--opt');
    return opt ? [opt.closest('.field')] : [];
  }

  function rechtsLinks() {
    var d = doc();
    if (!d) return [];
    var navs = d.querySelectorAll('.footer__inner nav.footer__nav');
    var treffer = [];
    if (!navs.length) return treffer;
    Array.prototype.forEach.call(navs[navs.length - 1].querySelectorAll('a'), function (a) {
      if (/\.html$/.test(a.getAttribute('href') || '')) treffer.push(a);
    });
    return treffer;
  }

  function ein(id) {
    var d = doc();
    var el = d ? d.querySelector(id) : null;
    return el ? [el] : [];
  }

  var ZIELE = {
    topbar: function () { return ein('.topbar'); },
    hero: function () { return ein('.hero'); },
    stats: function () { return ein('.stats'); },
    leistungen: function () { return ein('#leistungen'); },
    ablauf: function () { return ein('#ablauf'); },
    usp: sandAbschnitte,
    bewertungen: function () { return ein('#bewertungen'); },
    faq: function () { return ein('#faq'); },
    galerie: function () {
      var d = doc();
      if (!d) return [];
      return [
        d.querySelector('#referenzen .section__head'),
        d.querySelector('#referenzen .filters'),
        d.querySelector('#referenzen .gallery')
      ].filter(Boolean);
    },
    bavorsnachher: function () { return ein('#ba'); },
    formular: function () { return ein('#kontakt form.form'); },
    sms: feldVonSms,
    telefoncta: function () { return ein('.cta'); },
    recht: rechtsLinks
  };

  function setzeSichtbarkeit(id, an) {
    var treffer = (ZIELE[id] || function () { return []; })();
    if (!treffer) return;
    Array.prototype.forEach.call(treffer, function (el) {
      if (!el) return;
      if (!urspruenglich.has(el)) urspruenglich.set(el, el.style.display);
      el.style.display = an ? urspruenglich.get(el) : 'none';
    });
  }

  /* Die Referenz-Sektion trägt Galerie und Vorher/Nachher gemeinsam. */
  function aktualisiereReferenzen() {
    var d = doc();
    if (!d) return;
    var sektion = d.querySelector('#referenzen');
    if (!sektion) return;
    var RahmenSichtbar = Boolean(zustand.galerie) || Boolean(zustand.bavorsnachher);
    if (!urspruenglich.has(sektion)) urspruenglich.set(sektion, sektion.style.display);
    sektion.style.display = RahmenSichtbar ? urspruenglich.get(sektion) : 'none';
  }

  /* ---------- Vorschau anwenden ---------- */
  function anwenden() {
    if (doc()) {
      MODULE.forEach(function (m) {
        var an = Boolean(zustand[m.id]);

        if (m.id === 'sms') {
          if (!zustand.formular) an = false;
          var cb = doc().querySelector('#sms');
          if (cb) cb.checked = an;
        }

        setzeSichtbarkeit(m.id, an);
      });

      aktualisiereReferenzen();
    }

    rechnen();
  }

  /* ---------- Liste aufbauen ---------- */
  function baueListe() {
    var liste = document.getElementById('liste');
    var gruppen = [];

    gruppen.push({
      titel: 'Grundaufbau — in jedem Angebot enthalten',
      eintraege: BASIS.map(function (b) {
        return { id: b.id, name: b.name, std: b.std, fest: true, an: true };
      })
    });

    MODULE.forEach(function (m) {
      var g = gruppen.filter(function (x) { return x.titel === m.gruppe; })[0];
      if (!g) {
        g = { titel: m.gruppe, eintraege: [] };
        gruppen.push(g);
      }
      g.eintraege.push(m);
    });

    liste.innerHTML = '';

    gruppen.forEach(function (g) {
      var h = document.createElement('h2');
      h.className = 'gruppe';
      h.textContent = g.titel;
      liste.appendChild(h);

      g.eintraege.forEach(function (m) {
        zustand[m.id] = m.an !== false;

        var label = document.createElement('label');
        label.className = 'posten' + (m.fest ? ' posten--fest' : '');
        label.setAttribute('for', 'cb-' + m.id);

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'cb-' + m.id;
        cb.checked = zustand[m.id];
        cb.addEventListener('change', function () {
          zustand[m.id] = cb.checked;
          anwenden();
        });

        var text = document.createElement('span');
        text.className = 'posten__text';
        text.innerHTML = '<b>' + m.name + '</b>' +
          (m.pflicht ? '<em class="posten__pflicht">Pflicht</em>' : '');

        var preis = document.createElement('span');
        preis.className = 'posten__preis';
        preis.textContent = m.std + ' Std · ' + euro(m.std * STUNDENSATZ);

        label.appendChild(cb);
        label.appendChild(text);
        label.appendChild(preis);
        liste.appendChild(label);
      });
    });
  }

  /* ---------- Rechnen ---------- */
  function rechnen() {
    var s = summe();
    var gesamt = s.leistung + NEBENKOSTEN + RECHTSTEXT;

    document.getElementById('stunden').textContent = String(s.std);
    document.getElementById('leistung').textContent = euro(s.leistung);
    document.getElementById('gesamt').textContent = euro(gesamt);

    var fehlend = MODULE.filter(function (m) {
      return m.pflicht && !zustand[m.id];
    });

    var hinweis = document.getElementById('hinweis');
    if (fehlend.length) {
      hinweis.hidden = false;
      hinweis.textContent = fehlend[0].pflicht;
    } else {
      hinweis.hidden = true;
      hinweis.textContent = '';
    }

    var minimum = Math.ceil((25 + 9 + 2) * STUNDENSATZ + NEBENKOSTEN + RECHTSTEXT);
    document.getElementById('preisrahmen').textContent =
      'Bei dieser Auswahl liegt der Rahmen zwischen ' + euro(minimum) +
      ' und ' + euro(maximal()) + '. Verbindlich wird erst das schriftliche Angebot.';

    stand.textContent = s.gewaehlt.length + ' von ' + MODULE.length +
      ' Bausteinen sichtbar · ' + s.std + ' Stunden';
  }

  function maximal() {
    var std = GRUNDSTD;
    MODULE.forEach(function (m) { std += m.std; });
    return std * STUNDENSATZ + NEBENKOSTEN + RECHTSTEXT;
  }

  /* ---------- Vorauswahl ---------- */
  function markiereVorlage(name) {
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.classList.toggle('is-an', b.dataset.preset === name);
    });
  }

  function setzeVorlage(name) {
    MODULE.forEach(function (m) {
      zustand[m.id] = VORLAGEN[name].indexOf(m.id) !== -1;
    });
    markiereVorlage(name);
    abbilden();
  }

  function abbilden() {
    document.querySelectorAll('#liste input[type="checkbox"]').forEach(function (cb) {
      var id = cb.id.replace(/^cb-/, '');
      cb.checked = Boolean(zustand[id]);
    });
    anwenden();
  }

  document.querySelectorAll('[data-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setzeVorlage(btn.dataset.preset);
    });
  });

  /* ---------- Auswahl ins Angebot übernehmen ---------- */
  function uebersicht() {
    var s = summe();
    var zeilen = s.gewaehlt.map(function (m) {
      return '  · ' + m.name + '  (' + m.std + ' Std.)';
    });
    return [
      'Auswahl aus dem Website-Konfigurator:',
      zeilen.join('\n'),
      '',
      'Grundaufbau: ' + GRUNDSTD + ' Stunden · ' + (s.std - GRUNDSTD) +
        ' Stunden Bausteine',
      'Summe netto: ' + euro(s.leistung + NEBENKOSTEN + RECHTSTEXT)
    ].join('\n');
  }

  document.getElementById('uebernehmen').addEventListener('click', function () {
    var d = doc();
    var feld = d.getElementById('nachricht');
    if (!feld) return;

    var kennung = 'Auswahl aus dem Website-Konfigurator';
    if (feld.value.indexOf(kennung) === -1) {
      feld.value = feld.value.trim()
        ? feld.value.trim() + '\n\n' + uebersicht()
        : uebersicht();
    }

    var kontakt = d.getElementById('kontakt');
    if (kontakt && zustand.formular) {
      kontakt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (!zustand.formular) {
      window.alert(
        'Das Kontaktformular ist in der Vorschau ausgeblendet.\n\n' +
        'Die Auswahl steht trotzdem fest und geht als Erstes an den Betrieb ' +
        '— schalten Sie das Formular wieder ein, wenn der Kunde es absenden soll.'
      );
    }
  });

  document.getElementById('drucken').addEventListener('click', function () {
    var s = summe();
    var zeilen = s.gewaehlt.map(function (m) {
      return '<tr><td>' + m.name + '</td><td>' + m.std + '</td><td>' +
        euro(m.std * STUNDENSATZ) + '</td></tr>';
    }).join('');

    druckbogen.innerHTML =
      '<h1>Website-Konfigurator — Preisrichtwert</h1>' +
      '<p>Musterbetrieb Steinwerk · Stand ' +
      new Date().toLocaleDateString('de-DE') + '</p>' +
      '<h2>Bausteine</h2><table><thead><tr><th>Leistung</th><th>Std.</th>' +
      '<th>Summe</th></tr></thead><tbody>' +
      '<tr><td>Grundaufbau: Konzeption, Design, 5 Unterseiten</td><td>' +
      GRUNDSTD + '</td><td>' + euro(GRUNDSTD * STUNDENSATZ) + '</td></tr>' +
      zeilen + '</tbody></table>' +
      '<p class="druck-summe">Summe netto: <b>' +
      euro(s.leistung + NEBENKOSTEN + RECHTSTEXT) + '</b> ' +
      '(inkl. Domain .de 7,00 € und Rechtstexte 118,00 €)</p>' +
      '<p class="druck-fuss">Preisrichtwert, kein bindender Festpreis. ' +
      'Maßgeblich ist das schriftliche Angebot.</p>';

    window.print();
  });

  /* ---------- Vollbild ---------- */
  document.getElementById('vollbild').addEventListener('click', function () {
    var el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    } else {
      document.body.classList.toggle('ist-breit');
    }
  });

  document.getElementById('zurueck').addEventListener('click', function () {
    if (document.exitFullscreen) document.exitFullscreen();
    document.body.classList.remove('ist-breit');
  });

  document.addEventListener('fullscreenchange', function () {
    var voll = Boolean(document.fullscreenElement);
    document.body.classList.toggle('ist-vollbild', voll);
    document.getElementById('zurueck').hidden = !voll;
    document.getElementById('vollbild').textContent = voll ? 'Vollbild verlassen' : 'Vollbild';
  });

  /* ---------- Vorschubreite ---------- */
  document.querySelectorAll('[data-breite]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-breite]').forEach(function (b) {
        b.classList.remove('is-an');
      });
      btn.classList.add('is-an');

      var px = BREITEN[btn.dataset.breite];
      vorschau.style.maxWidth = px ? px + 'px' : '';
      vorschau.classList.toggle('vorschau--schmal', Boolean(px));
    });
  });

  /* ---------- Vorschau am Platz halten ---------- */
  /* Ein Klick auf Impressum, Datenschutz oder einen Anker wuerde die Demo
     aus dem iframe heraus navigieren. Die Auswahl ginge dabei verloren,
     also bleiben wir immer auf index.html. */
  frame.addEventListener('load', function () {
    anwenden();

    var d = doc();
    if (!d) return;

    d.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;

      var href = a.getAttribute('href') || '';
      var istSprung = href.charAt(0) === '#';

      if (!istSprung) e.preventDefault();

      if (istSprung) {
        var ziel = d.querySelector(href);
        if (ziel && ziel.scrollIntoView) {
          e.preventDefault();
          ziel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, false);
  });

  /* ---------- Start ---------- */
  baueListe();
  markiereVorlage('standard');
  rechnen();
})();