// Small self-contained calendar popover for picking a start/end date range.
// Tap a day to set the start, tap another to set the end (tapping before the
// start re-anchors it). No external deps — renders into the #datePickerOverlay
// markup already in index.html.

const DatePicker = (() => {
  const $ = (id) => document.getElementById(id);
  let overlay, monthLabelEl, gridEl, rangeTextEl, prevBtn, nextBtn, clearBtn, doneBtn;
  let currentMonth = null; // Date, first-of-month
  let rangeStart = null;   // 'YYYY-MM-DD'
  let rangeEnd = null;
  let doneCallback = null;
  let wired = false;

  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function todayISO() {
    const t = new Date();
    return toISO(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function fmtShort(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function selectDay(iso) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      rangeStart = iso;
      rangeEnd = null;
    } else if (iso < rangeStart) {
      rangeStart = iso;
      rangeEnd = null;
    } else {
      rangeEnd = iso;
    }
    render();
  }

  function render() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    monthLabelEl.textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    gridEl.innerHTML = '';
    const firstWeekday = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const today = todayISO();

    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-day cal-blank';
      gridEl.appendChild(blank);
    }

    for (let d = 1; d <= totalDays; d++) {
      const iso = toISO(y, m, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(d);
      if (iso === today) btn.classList.add('cal-today');
      if (iso === rangeStart || iso === rangeEnd) btn.classList.add('cal-selected');
      if (rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd) btn.classList.add('cal-in-range');
      btn.addEventListener('click', () => selectDay(iso));
      gridEl.appendChild(btn);
    }

    rangeTextEl.textContent = !rangeStart
      ? 'Tap a start date'
      : !rangeEnd
        ? `${fmtShort(rangeStart)} → tap an end date`
        : `${fmtShort(rangeStart)} – ${fmtShort(rangeEnd)}`;
  }

  function wire() {
    if (wired) return;
    wired = true;
    overlay = $('datePickerOverlay');
    monthLabelEl = $('calMonthLabel');
    gridEl = $('calGrid');
    rangeTextEl = $('calRangeText');
    prevBtn = $('calPrevBtn');
    nextBtn = $('calNextBtn');
    clearBtn = $('calClearBtn');
    doneBtn = $('calDoneBtn');

    prevBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
    });
    nextBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
    });
    clearBtn.addEventListener('click', () => { rangeStart = null; rangeEnd = null; render(); });
    doneBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
      if (doneCallback) doneCallback({ start: rangeStart, end: rangeEnd });
    });
  }

  function open({ start, end, onDone } = {}) {
    wire();
    rangeStart = start || null;
    rangeEnd = end || null;
    doneCallback = onDone || null;
    const anchor = rangeStart ? new Date(rangeStart + 'T00:00:00') : new Date();
    currentMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    render();
    overlay.classList.add('open');
  }

  return { open };
})();
