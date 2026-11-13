/* SISTEMA SONNO · dati della mappa del sistema (condivisi da network.js e sleepmap.js) */
(function () {
  var majors = [
    { id: 'm0', idx: '01', x: 164, y: 96,  key: 'Comportamenti',        lbl: ['Comportamenti'],
      ax: 'middle', dx: 0, dy: -22, dix: -26, diy: 3,
      desc: "Abitudini, controllo dello stimolo e condizionamenti ambientali si rinforzano a vicenda: quando sono coerenti insegnano al corpo ad associare il letto al sonno, quando sono in conflitto lo tengono sveglio anche da stanco." },
    { id: 'm1', idx: '02', x: 436, y: 92,  key: 'Nutrizione',           lbl: ['Nutrizione'],
      ax: 'middle', dx: 0, dy: -22, dix: 26, diy: 3,
      desc: "Timing dei pasti, caffeina, alcol ed equilibrio metabolico-ormonale si influenzano a vicenda lungo la giornata: basta che uno solo sia fuori posto per ritardare l'addormentamento o frammentare il sonno nella notte." },
    { id: 'm2', idx: '03', x: 488, y: 214, key: 'Sistema riposo',       lbl: ['Sistema', 'riposo'],
      ax: 'end', dx: -20, dy: -4, dix: 24, diy: 3,
      desc: "Postura notturna, compensazione fisiologica, supporto e termoregolazione dipendono l'uno dall'altro: un materasso che non li bilancia insieme genera microrisvegli continui, anche quando non te ne accorgi." },
    { id: 'm3', idx: '04', x: 356, y: 342, key: 'Ritmi circadiani',     lbl: ['Ritmi', 'circadiani'],
      ax: 'middle', dx: 0, dy: 28, dix: 0, diy: -22,
      desc: "Cronotipo, regolarità e forza del ritmo circadiano determinano insieme la finestra in cui il corpo è biologicamente pronto a dormire: se sono disallineati, ti addormenti fuori orario o dormi meno profondamente." },
    { id: 'm4', idx: '05', x: 178, y: 340, key: 'Gestione dello stress', lbl: ['Gestione', 'dello stress'],
      ax: 'middle', dx: 0, dy: 28, dix: 0, diy: -22,
      desc: "Attivazione cognitiva ed emotiva, credenze disfunzionali e gestione dei pensieri si alimentano a vicenda: una mente che non riesce a spegnersi mantiene il corpo in uno stato di allerta incompatibile col sonno." },
    { id: 'm5', idx: '06', x: 104, y: 210, key: 'Ambiente',             lbl: ['Ambiente'],
      ax: 'start', dx: 20, dy: -4, dix: -24, diy: 3,
      desc: "Luce, temperatura, rumore e qualità dell'aria agiscono insieme sui segnali che il corpo usa per capire quando dormire: basta che uno sia fuori equilibrio per abbassare la qualità del sonno, anche se gli altri sono perfetti." }
  ];
  var core = { id: 'core', x: 300, y: 208, lbl: 'SONNO' };
  var minors = [
    /* Comportamenti (m0) */
    { id: 'abitudini',          x: 95,  y: 106, lbl: 'Abitudini',                                  la: 'e' },
    { id: 'controllo-stimolo',  x: 85,  y: 135, lbl: ['Controllo dello', 'stimolo'],                la: 'b' },
    { id: 'condiz-ambientali',  x: 250, y: 110, lbl: ['Condizionamenti', 'ambientali'],             la: 'b' },

    /* Nutrizione (m1) */
    { id: 'timing',             x: 500, y: 16,  lbl: ['Timing dei', 'pasti'],                       la: 'b' },
    { id: 'caffeina',           x: 520, y: 70,  lbl: 'Caffeina',                                    la: 's' },
    { id: 'alcol',              x: 498, y: 113, lbl: 'Alcol',                                       la: 's' },
    { id: 'equilibrio',         x: 460, y: 175, lbl: ['Equilibrio', 'metabolico-ormonale'],         la: 'e' },

    /* Sistema riposo (m2) */
    { id: 'postura',            x: 550, y: 150, lbl: ['Postura', 'notturna'],                       la: 'e' },
    { id: 'compensazione',      x: 575, y: 268, lbl: ['Compensazione', 'fisiologica'],               la: 'e' },
    { id: 'supporto',           x: 548, y: 305, lbl: 'Supporto',                                    la: 'e' },
    { id: 'termoregolazione',   x: 495, y: 356, lbl: 'Termoregolazione',                             la: 'b' },

    /* Ritmi circadiani (m3) */
    { id: 'cronotipo',          x: 330, y: 398, lbl: 'Cronotipo',                                   la: 'b' },
    { id: 'regolarita',         x: 445, y: 385, lbl: ['Regolarità', 'circadiana'],                  la: 'b' },
    { id: 'forza-ritmo',        x: 430, y: 340, lbl: 'Forza del ritmo',                              la: 's' },

    /* Gestione dello stress (m4) */
    { id: 'attivazione',        x: 110, y: 300, lbl: ['Attivazione cognitiva', 'ed emotiva'],       la: 'a' },
    { id: 'credenze',           x: 90,  y: 393, lbl: ['Credenze', 'disfunzionali'],                 la: 'b' },
    { id: 'pensieri',           x: 215, y: 393, lbl: ['Gestione dei', 'pensieri'],                  la: 'b' },

    /* Ambiente (m5) */
    { id: 'luce',               x: 45,  y: 195, lbl: 'Luce',                                        la: 's' },
    { id: 'temperatura',        x: 22,  y: 248, lbl: 'Temperatura',                                 la: 's' },
    { id: 'rumore',             x: 40,  y: 316, lbl: 'Rumore',                                       la: 's' },
    { id: 'aria',               x: 80,  y: 335, lbl: ['Qualità', "dell'aria"],                      la: 'b' }
  ];
  var edges = [
    /* core → alcuni maggiori (sottile) */
    ['core', 'm0'], ['core', 'm1'], ['core', 'm3'], ['core', 'm5'],
    /* maggiore ↔ maggiore (interdipendenze) */
    ['m0', 'm1'], ['m0', 'm4'], ['m1', 'm3'], ['m2', 'm5'],
    ['m2', 'm3'], ['m3', 'm5'], ['m4', 'm3'], ['m4', 'm5'],
    /* secondari → maggiori (corrispondenza 1:1 con la tassonomia della mappa) */
    ['abitudini', 'm0'], ['controllo-stimolo', 'm0'], ['condiz-ambientali', 'm0'],
    ['timing', 'm1'], ['caffeina', 'm1'], ['alcol', 'm1'], ['equilibrio', 'm1'],
    ['postura', 'm2'], ['compensazione', 'm2'], ['supporto', 'm2'], ['termoregolazione', 'm2'],
    ['cronotipo', 'm3'], ['regolarita', 'm3'], ['forza-ritmo', 'm3'],
    ['attivazione', 'm4'], ['credenze', 'm4'], ['pensieri', 'm4'],
    ['luce', 'm5'], ['temperatura', 'm5'], ['rumore', 'm5'], ['aria', 'm5']
  ];
  var pulseEdges = { 'core|m1': 1, 'core|m3': 1, 'm3|m5': 1, 'm0|m4': 1 };
  window.SLEEP_MAP = { majors: majors, core: core, minors: minors, edges: edges, pulseEdges: pulseEdges };
})();
