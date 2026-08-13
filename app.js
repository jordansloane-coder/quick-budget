(() => {
  'use strict';

  const DEFAULT_CATEGORIES = ['Food', 'Gas', 'Lodging', 'Supplies', 'Transport', 'Other'];
  const DEFAULT_BUDGET = 811;
  const MAX_IMAGE_DIM = 1400;

  const state = {
    settings: { apiKey: '' },
    trip: null,       // the active trip record { id, name, budget, createdAt, archivedAt }
    trips: [],         // every trip ever created, active and banked
    allExpenses: [],    // every expense ever logged, across all trips (tagged by tripId)
    allChecklist: [],   // every checklist item ever added, across all trips (tagged by tripId)
    allTravelInfo: [],  // every travel info entry ever added, across all trips (tagged by tripId)
    editingId: null,
    pendingPhoto: null,   // dataURL currently attached in the expense modal
    pendingAddress: null, // address text currently attached in the expense modal (from a scanned receipt)
  };

  // ---------- element refs ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    bigNumber: $('bigNumber'), bigSub: $('bigSub'), progressFill: $('progressFill'),
    spentLabel: $('spentLabel'), budgetLabel: $('budgetLabel'), tripLabel: $('tripLabel'),
    countdownWrap: $('countdownWrap'), tripCountdown: $('tripCountdown'),
    expenseList: $('expenseList'), emptyState: $('emptyState'), countPill: $('countPill'),
    addBtn: $('addBtn'), scanBtn: $('scanBtn'), menuBtn: $('menuBtn'), settingsBtn: $('settingsBtn'),

    checklistToggle: $('checklistToggle'), checklistBody: $('checklistBody'), checklistCount: $('checklistCount'),
    checklistInput: $('checklistInput'), checklistAddBtn: $('checklistAddBtn'), checklistList: $('checklistList'),

    expenseModalOverlay: $('expenseModalOverlay'), expenseModalTitle: $('expenseModalTitle'),
    amountInput: $('amountInput'), vendorInput: $('vendorInput'), dateInput: $('dateInput'),
    categoryInput: $('categoryInput'), categoryChipRow: $('categoryChipRow'), categoryDatalist: $('categoryDatalist'),
    receiptPreviewWrap: $('receiptPreviewWrap'), receiptPreviewImg: $('receiptPreviewImg'),
    attachPhotoBtn: $('attachPhotoBtn'), removePhotoBtn: $('removePhotoBtn'), photoFileInput: $('photoFileInput'),
    excludeFromBudgetInput: $('excludeFromBudgetInput'),
    saveExpenseBtn: $('saveExpenseBtn'), deleteExpenseBtn: $('deleteExpenseBtn'), aiReadBtn: $('aiReadBtn'),

    scanModalOverlay: $('scanModalOverlay'),
    scanChooseStep: $('scanChooseStep'), scanLoadingStep: $('scanLoadingStep'), scanErrorStep: $('scanErrorStep'),
    scanCameraBtn: $('scanCameraBtn'), scanLibraryBtn: $('scanLibraryBtn'),
    scanCameraInput: $('scanCameraInput'), scanLibraryInput: $('scanLibraryInput'),
    scanLoadingImg: $('scanLoadingImg'), scanErrorText: $('scanErrorText'), scanErrorManualBtn: $('scanErrorManualBtn'),
    scanNoKeyNote: $('scanNoKeyNote'), scanNoKeySettingsLink: $('scanNoKeySettingsLink'),

    settingsModalOverlay: $('settingsModalOverlay'), tripNameInput: $('tripNameInput'),
    budgetInput: $('budgetInput'), apiKeyInput: $('apiKeyInput'), saveSettingsBtn: $('saveSettingsBtn'),
    resetAllBtn: $('resetAllBtn'), loadSampleBtn: $('loadSampleBtn'), tripDatesBtn: $('tripDatesBtn'),
    countModeDownBtn: $('countModeDownBtn'), countModeUpBtn: $('countModeUpBtn'),
    startNewTripBtn: $('startNewTripBtn'), newTripForm: $('newTripForm'), bankSummaryText: $('bankSummaryText'),
    newTripNameInput: $('newTripNameInput'), newTripBudgetInput: $('newTripBudgetInput'), newTripDatesBtn: $('newTripDatesBtn'),
    newCountModeDownBtn: $('newCountModeDownBtn'), newCountModeUpBtn: $('newCountModeUpBtn'),
    cancelNewTripBtn: $('cancelNewTripBtn'), confirmNewTripBtn: $('confirmNewTripBtn'),
    pastTripsSection: $('pastTripsSection'), pastTripsList: $('pastTripsList'),

    reportModalOverlay: $('reportModalOverlay'), reportBody: $('reportBody'), printReportBtn: $('printReportBtn'),
    exportReportCsvBtn: $('exportReportCsvBtn'),
    scanModalTitle: $('scanModalTitle'), scanChooseHint: $('scanChooseHint'), scanLoadingHint: $('scanLoadingHint'),

    travelInfoBtn: $('travelInfoBtn'), travelInfoOverlay: $('travelInfoOverlay'), travelInfoTitle: $('travelInfoTitle'),
    travelInfoListView: $('travelInfoListView'), addTravelInfoBtn: $('addTravelInfoBtn'),
    travelInfoList: $('travelInfoList'), travelInfoEmpty: $('travelInfoEmpty'),
    travelInfoFormView: $('travelInfoFormView'), travelInfoFormFooter: $('travelInfoFormFooter'),
    travelPhotoPreviewWrap: $('travelPhotoPreviewWrap'), travelPhotoPreviewImg: $('travelPhotoPreviewImg'),
    travelAttachPhotoBtn: $('travelAttachPhotoBtn'), travelRemovePhotoBtn: $('travelRemovePhotoBtn'),
    travelPhotoFileInput: $('travelPhotoFileInput'), travelTypeChipRow: $('travelTypeChipRow'),
    travelCustomTypeInput: $('travelCustomTypeInput'), travelReadFromPhotoBtn: $('travelReadFromPhotoBtn'),
    travelNameLabel: $('travelNameLabel'), travelNameInput: $('travelNameInput'),
    travelConfirmationInput: $('travelConfirmationInput'),
    travelAddressLabel: $('travelAddressLabel'), travelAddressInput: $('travelAddressInput'),
    travelStartLabel: $('travelStartLabel'), travelStartInput: $('travelStartInput'),
    travelEndLabel: $('travelEndLabel'), travelEndInput: $('travelEndInput'),
    travelNotesInput: $('travelNotesInput'),
    deleteTravelInfoBtn: $('deleteTravelInfoBtn'), backTravelInfoBtn: $('backTravelInfoBtn'),
    saveTravelInfoBtn: $('saveTravelInfoBtn'),

    googleSignedOutView: $('googleSignedOutView'), googleSignedInView: $('googleSignedInView'),
    googleSignInBtn: $('googleSignInBtn'), googleBackupStatus: $('googleBackupStatus'),
    driveBackupBtn: $('driveBackupBtn'), driveRestoreBtn: $('driveRestoreBtn'),
    googleSignOutBtn: $('googleSignOutBtn'),

    toast: $('toast'),
  };

  let scanPendingPhoto = null; // dataURL being scanned
  let currentReportContext = null; // { trip, expenses } for whatever the report modal is currently showing
  let travelEditingId = null;    // id of the travel info entry being edited, null = new
  let travelPendingPhoto = null; // dataURL currently attached in the travel info form
  let travelPendingType = 'hotel';

  const TRAVEL_TYPE_META = {
    hotel: { emoji: '🏨', label: 'Hotel', nameLabel: 'Hotel Name', addressLabel: 'Address', startLabel: 'Check-in', endLabel: 'Check-out' },
    flight: { emoji: '✈️', label: 'Flight', nameLabel: 'Airline', addressLabel: 'Airport / Location', startLabel: 'Departure', endLabel: 'Arrival' },
    car: { emoji: '🚗', label: 'Car Rental', nameLabel: 'Rental Company', addressLabel: 'Pick-up Location', startLabel: 'Pick-up Time', endLabel: 'Drop-off Time' },
    other: { emoji: '📌', label: 'Other', nameLabel: 'Name', addressLabel: 'Address / Location', startLabel: 'Start', endLabel: 'End' },
  };
  let pendingTripDates = { start: null, end: null };    // being edited for the active trip, in Settings
  let pendingNewTripDates = { start: null, end: null }; // being set for the trip about to be started
  let pendingCountMode = 'countdown';    // being edited for the active trip, in Settings
  let pendingNewCountMode = 'countdown'; // being set for the trip about to be started

  // ---------- utils ----------
  const fmtMoney = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtMoneyShort = (n) => {
    const rounded = Math.round(n * 100) / 100;
    return `$${rounded % 1 === 0 ? rounded.toLocaleString('en-US') : rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const daysBetween = (aIso, bIso) => Math.round((new Date(bIso + 'T00:00:00') - new Date(aIso + 'T00:00:00')) / 86400000);
  const fmtTimestamp = (ms) => {
    const d = new Date(ms);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${date} ${time}`;
  };
  const locationLabel = (e) => e.address || (e.lat != null ? `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}` : '');

  function tripCountdownText(trip) {
    if (!trip.startDate) return '';
    const today = todayISO();
    if (today < trip.startDate) {
      const d = daysBetween(today, trip.startDate);
      return d === 1 ? '🗓️ Trip starts tomorrow' : `🗓️ ${d} days until trip`;
    }
    if (trip.endDate) {
      if (today > trip.endDate) return '';
      const d = daysBetween(today, trip.endDate);
      if (d === 0) return '🗓️ Last day of the trip';
      return d === 1 ? '🗓️ 1 day left' : `🗓️ ${d} days left`;
    }
    const dayNum = daysBetween(trip.startDate, today) + 1;
    return `🗓️ Day ${dayNum}`;
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const fmtShortDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtLongDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function dateRangeLabel(start, end) {
    if (!start) return '📅 Set trip dates';
    return end ? `📅 ${fmtShortDate(start)} – ${fmtShortDate(end)}` : `📅 ${fmtShortDate(start)} – …`;
  }

  function showToast(msg, ms = 2600) {
    el.toast.textContent = msg;
    el.toast.classList.add('visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove('visible'), ms);
  }

  function openModal(overlay) { overlay.classList.add('open'); }
  function closeModal(overlay) { overlay.classList.remove('open'); }

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal($(btn.dataset.close)));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  });

  function downscaleImage(dataUrl, maxDim = MAX_IMAGE_DIM, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = dataUrl;
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // ---------- derived data ----------
  function activeExpenses() {
    return state.allExpenses
      .filter((e) => e.tripId === state.trip.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function activeChecklist() {
    return state.allChecklist.filter((i) => i.tripId === state.trip.id);
  }

  function activeTravelInfo() {
    return state.allTravelInfo
      .filter((i) => i.tripId === state.trip.id)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function totalSpent(expenses = activeExpenses()) {
    return expenses.filter((e) => !e.excludeFromBudget).reduce((sum, e) => sum + e.amount, 0);
  }

  function allCategories() {
    const used = activeExpenses().map((e) => e.category).filter(Boolean);
    const set = new Set([...DEFAULT_CATEGORIES, ...used]);
    return Array.from(set);
  }

  // ---------- render ----------
  function renderHero() {
    const spent = totalSpent();
    const budget = state.trip.budget || 0;
    const remaining = budget - spent;
    const ratio = budget > 0 ? Math.max(0, remaining) / budget : 0;

    el.tripLabel.textContent = state.trip.name || 'Trip Budget';

    const countdownText = tripCountdownText(state.trip);
    el.tripCountdown.textContent = countdownText;
    el.countdownWrap.style.display = countdownText ? '' : 'none';

    if (state.trip.countMode === 'countup') {
      el.bigNumber.textContent = fmtMoneyShort(spent);
      el.bigSub.textContent = remaining < 0 ? 'spent so far — over budget' : 'spent so far';
    } else {
      el.bigNumber.textContent = remaining < 0 ? `-${fmtMoneyShort(Math.abs(remaining))}` : fmtMoneyShort(remaining);
      el.bigSub.textContent = remaining < 0 ? 'over budget' : 'left to spend';
    }

    el.bigNumber.classList.remove('good', 'warn', 'bad');
    el.progressFill.classList.remove('warn', 'bad');
    if (remaining < 0 || ratio < 0.15) { el.bigNumber.classList.add('bad'); el.progressFill.classList.add('bad'); }
    else if (ratio < 0.35) { el.bigNumber.classList.add('warn'); el.progressFill.classList.add('warn'); }
    else { el.bigNumber.classList.add('good'); }

    const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
    el.progressFill.style.width = `${pct}%`;
    el.spentLabel.textContent = `${fmtMoney(spent)} spent`;
    el.budgetLabel.textContent = `of ${fmtMoney(budget)}`;

    el.bigNumber.classList.add('pulse');
    setTimeout(() => el.bigNumber.classList.remove('pulse'), 280);
  }

  const CATEGORY_EMOJI = { Food: '🍔', Gas: '⛽️', Lodging: '🛏️', Supplies: '🎬', Transport: '🚗', Other: '🧾' };

  function renderList() {
    const expenses = activeExpenses();
    el.expenseList.innerHTML = '';
    el.emptyState.classList.toggle('visible', expenses.length === 0);
    el.countPill.textContent = String(expenses.length);

    for (const expense of expenses) {
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.dataset.id = expense.id;

      const thumbHtml = expense.photo
        ? `<img class="expense-thumb" src="${expense.photo}" alt="Receipt">`
        : `<div class="expense-thumb-fallback">${CATEGORY_EMOJI[expense.category] || '🧾'}</div>`;

      const dateStr = expense.date ? new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

      li.innerHTML = `
        ${thumbHtml}
        <div class="expense-main">
          <div class="expense-vendor">${escapeHtml(expense.vendor || 'Expense')}</div>
          <div class="expense-meta">
            <span class="category-tag">${escapeHtml(expense.category || 'Other')}</span>
            <span>${dateStr}</span>
            ${expense.excludeFromBudget ? '<span class="excluded-tag">Not counted</span>' : ''}
          </div>
        </div>
        <div class="expense-amount">${fmtMoney(expense.amount)}</div>
      `;
      li.addEventListener('click', () => openExpenseModal(expense));
      el.expenseList.appendChild(li);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- checklist ----------
  function renderChecklist() {
    const items = activeChecklist();
    const unchecked = items.filter((i) => !i.checked).sort((a, b) => a.createdAt - b.createdAt);
    const checked = items.filter((i) => i.checked).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
    const ordered = [...unchecked, ...checked];

    el.checklistCount.textContent = items.length ? `${checked.length}/${items.length}` : '';
    el.checklistList.innerHTML = '';

    if (ordered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'checklist-empty';
      empty.textContent = 'Nothing on the list yet.';
      el.checklistList.appendChild(empty);
      return;
    }

    for (const item of ordered) {
      const li = document.createElement('li');
      li.className = 'checklist-item' + (item.checked ? ' checked' : '');
      li.innerHTML = `
        <button type="button" class="checklist-checkbox" aria-label="Toggle done"></button>
        <span class="checklist-text">${escapeHtml(item.text)}</span>
        <button type="button" class="checklist-delete" aria-label="Delete item">✕</button>
      `;
      li.querySelector('.checklist-checkbox').addEventListener('click', () => toggleChecklistItem(item));
      li.querySelector('.checklist-delete').addEventListener('click', () => deleteChecklistItem(item));
      el.checklistList.appendChild(li);
    }
  }

  async function addChecklistItem() {
    const text = el.checklistInput.value.trim();
    if (!text) return;
    // Clear before the write resolves — a fast double-tap on Add would otherwise
    // read the same not-yet-cleared text twice and create a duplicate item.
    el.checklistInput.value = '';
    const item = { id: uid(), tripId: state.trip.id, text, checked: false, createdAt: Date.now(), checkedAt: null };
    await DB.putChecklistItem(item);
    state.allChecklist.unshift(item);
    renderChecklist();
  }

  async function toggleChecklistItem(item) {
    item.checked = !item.checked;
    item.checkedAt = item.checked ? Date.now() : null;
    await DB.putChecklistItem(item);
    renderChecklist();
  }

  async function deleteChecklistItem(item) {
    await DB.deleteChecklistItem(item.id);
    state.allChecklist = state.allChecklist.filter((i) => i.id !== item.id);
    renderChecklist();
  }

  el.checklistToggle.addEventListener('click', () => {
    const isOpen = el.checklistBody.style.display !== 'none';
    el.checklistBody.style.display = isOpen ? 'none' : '';
    el.checklistToggle.classList.toggle('open', !isOpen);
  });
  el.checklistAddBtn.addEventListener('click', addChecklistItem);
  el.checklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); }
  });

  function renderAll() { renderHero(); renderList(); renderChecklist(); }

  // ---------- expense modal ----------
  function renderCategoryChips(selected) {
    el.categoryChipRow.innerHTML = '';
    el.categoryDatalist.innerHTML = '';
    for (const cat of allCategories()) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'category-chip' + (cat === selected ? ' selected' : '');
      chip.textContent = `${CATEGORY_EMOJI[cat] || ''} ${cat}`.trim();
      chip.addEventListener('click', () => {
        el.categoryInput.value = cat;
        renderCategoryChips(cat);
      });
      el.categoryChipRow.appendChild(chip);

      const opt = document.createElement('option');
      opt.value = cat;
      el.categoryDatalist.appendChild(opt);
    }
  }

  function openExpenseModal(existing = null, prefill = null) {
    state.editingId = existing ? existing.id : null;
    state.pendingPhoto = existing ? (existing.photo || null) : (prefill && prefill.photo) || null;
    state.pendingAddress = existing ? (existing.address || null) : (prefill && prefill.address) || null;

    el.expenseModalTitle.textContent = existing ? 'Edit Expense' : 'Add Expense';
    el.deleteExpenseBtn.style.display = existing ? '' : 'none';

    const source = existing || prefill || {};
    el.amountInput.value = source.amount != null ? source.amount : '';
    el.vendorInput.value = source.vendor || '';
    el.dateInput.value = source.date || todayISO();
    el.categoryInput.value = source.category || '';
    renderCategoryChips(source.category || '');
    el.excludeFromBudgetInput.checked = !!source.excludeFromBudget;

    if (state.pendingPhoto) {
      el.receiptPreviewImg.src = state.pendingPhoto;
      el.receiptPreviewWrap.style.display = '';
      el.removePhotoBtn.style.display = '';
    } else {
      el.receiptPreviewWrap.style.display = 'none';
      el.removePhotoBtn.style.display = 'none';
    }

    openModal(el.expenseModalOverlay);
    setTimeout(() => el.amountInput.focus(), 200);
  }

  el.addBtn.addEventListener('click', () => openExpenseModal());

  el.attachPhotoBtn.addEventListener('click', () => el.photoFileInput.click());
  el.photoFileInput.addEventListener('change', async () => {
    const file = el.photoFileInput.files[0];
    el.photoFileInput.value = '';
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleImage(raw);
      state.pendingPhoto = small;
      el.receiptPreviewImg.src = small;
      el.receiptPreviewWrap.style.display = '';
      el.removePhotoBtn.style.display = '';
    } catch (e) {
      showToast(e.message || 'Could not attach that photo.');
    }
  });
  el.removePhotoBtn.addEventListener('click', () => {
    state.pendingPhoto = null;
    el.receiptPreviewWrap.style.display = 'none';
    el.removePhotoBtn.style.display = 'none';
  });

  el.saveExpenseBtn.addEventListener('click', async () => {
    if (el.saveExpenseBtn.disabled) return; // guards against a fast double-tap creating a duplicate
    const amount = parseFloat(el.amountInput.value);
    if (!amount || amount <= 0) { showToast('Enter an amount greater than $0.'); el.amountInput.focus(); return; }

    el.saveExpenseBtn.disabled = true;
    try {
      const existing = state.editingId ? state.allExpenses.find((e) => e.id === state.editingId) : null;
      const isNew = !existing;

      const expense = {
        ...existing,
        id: state.editingId || uid(),
        tripId: state.trip.id,
        amount,
        vendor: el.vendorInput.value.trim() || 'Expense',
        category: el.categoryInput.value.trim() || 'Other',
        date: el.dateInput.value || todayISO(),
        photo: state.pendingPhoto || null,
        address: state.pendingAddress || null,
        excludeFromBudget: el.excludeFromBudgetInput.checked,
        createdAt: existing ? existing.createdAt : Date.now(),
      };

      await DB.putExpense(expense);
      const idx = state.allExpenses.findIndex((e) => e.id === expense.id);
      if (idx >= 0) state.allExpenses[idx] = expense; else state.allExpenses.unshift(expense);

      closeModal(el.expenseModalOverlay);
      renderAll();
      showToast(state.editingId ? 'Expense updated' : `Logged ${fmtMoney(amount)}`);

      // Prefer the address printed on a scanned receipt — it's the actual vendor location,
      // more accurate than GPS. Only fall back to device location when scanning didn't give us one.
      if (isNew && !expense.address) captureLocationForExpense(expense.id);
    } finally {
      el.saveExpenseBtn.disabled = false;
    }
  });

  el.deleteExpenseBtn.addEventListener('click', async () => {
    if (!state.editingId) return;
    await DB.deleteExpense(state.editingId);
    state.allExpenses = state.allExpenses.filter((e) => e.id !== state.editingId);
    closeModal(el.expenseModalOverlay);
    renderAll();
    showToast('Expense deleted');
  });

  // Captures where you were when an expense was logged, purely for the CSV export.
  // Silent best-effort: no permission prompt nagging, no toast on failure — if the
  // user denies location or it times out, the expense just has no location on it.
  async function captureLocationForExpense(expenseId) {
    if (!('geolocation' in navigator)) return;

    let position;
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 60000 });
      });
    } catch (e) {
      return; // permission denied, unavailable, or timed out — fine, leave it blank
    }

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    let address = null;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`);
      if (res.ok) {
        const data = await res.json();
        address = data.display_name || null;
      }
    } catch (e) {
      // offline or the geocoder is unreachable — coordinates alone are still useful
    }

    const expense = state.allExpenses.find((e) => e.id === expenseId);
    if (!expense) return; // deleted before this resolved
    if (expense.address) return; // a receipt scan already gave us the real vendor address in the meantime
    expense.lat = lat;
    expense.lng = lng;
    expense.address = address;
    await DB.putExpense(expense);
  }

  // ---------- scan flow (shared by receipt scanning and travel document reading) ----------
  // scanMode: 'expense' reads a receipt into the expense form. 'travel' reads a travel
  // document (hotel/flight/car/etc.) into the travel info form.
  // scanFillTarget: 'new' opens a fresh Add Expense modal prefilled with the result.
  // 'inline' fills the fields of the modal that's already open (Read from Photo).
  let scanMode = 'expense';
  let scanFillTarget = 'new';

  function resetScanModal() {
    el.scanChooseStep.style.display = '';
    el.scanLoadingStep.style.display = 'none';
    el.scanErrorStep.style.display = 'none';
    el.scanNoKeyNote.style.display = state.settings.apiKey ? 'none' : '';
    if (scanMode === 'travel') {
      el.scanModalTitle.textContent = 'Read Travel Document';
      el.scanChooseHint.textContent = 'Take a photo of a hotel confirmation, boarding pass, rental agreement, or any other travel document. Claude will try to read the details for you.';
      el.scanLoadingHint.textContent = 'Reading document…';
    } else {
      el.scanModalTitle.textContent = 'Scan Receipt';
      el.scanChooseHint.textContent = 'Take a photo of your receipt, or choose one from your library. Claude will try to read the vendor, total, date and category for you.';
      el.scanLoadingHint.textContent = 'Reading receipt…';
    }
  }

  function applyPhotoToOpenExpenseModal(photoDataUrl) {
    state.pendingPhoto = photoDataUrl;
    el.receiptPreviewImg.src = photoDataUrl;
    el.receiptPreviewWrap.style.display = '';
    el.removePhotoBtn.style.display = '';
  }

  function applyParsedToOpenExpenseModal(parsed, photoDataUrl) {
    applyPhotoToOpenExpenseModal(photoDataUrl);
    if (parsed.total != null) el.amountInput.value = parsed.total;
    if (parsed.vendor) el.vendorInput.value = parsed.vendor;
    if (parsed.date) el.dateInput.value = parsed.date;
    if (parsed.category) el.categoryInput.value = parsed.category;
    if (parsed.address) state.pendingAddress = parsed.address;
    renderCategoryChips(el.categoryInput.value);
  }

  function applyPhotoToTravelForm(photoDataUrl) {
    travelPendingPhoto = photoDataUrl;
    el.travelPhotoPreviewImg.src = photoDataUrl;
    el.travelPhotoPreviewWrap.style.display = '';
    el.travelRemovePhotoBtn.style.display = '';
  }

  // Claude returns a free-text type guess (e.g. "Train", "Insurance") rather than a fixed
  // enum, since travel info covers more than hotel/flight/car — map it onto one of our
  // preset chips when it clearly matches, otherwise fall back to "Other" + a custom label.
  function mapGuessedTravelType(guess) {
    const g = guess.toLowerCase();
    if (g.includes('hotel') || g.includes('lodging') || g.includes('motel') || g.includes('resort')) return { type: 'hotel', customType: '' };
    if (g.includes('flight') || g.includes('air')) return { type: 'flight', customType: '' };
    if (g.includes('car') || g.includes('rental')) return { type: 'car', customType: '' };
    return { type: 'other', customType: guess };
  }

  function applyParsedToTravelForm(parsed, photoDataUrl) {
    applyPhotoToTravelForm(photoDataUrl);
    if (parsed.name) el.travelNameInput.value = parsed.name;
    if (parsed.confirmationNumber) el.travelConfirmationInput.value = parsed.confirmationNumber;
    if (parsed.address) el.travelAddressInput.value = parsed.address;
    if (parsed.startAt) el.travelStartInput.value = parsed.startAt;
    if (parsed.endAt) el.travelEndInput.value = parsed.endAt;
    if (parsed.notes) el.travelNotesInput.value = parsed.notes;
    if (parsed.type) {
      const mapped = mapGuessedTravelType(parsed.type);
      travelPendingType = mapped.type;
      renderTravelTypeChips(travelPendingType);
      applyTravelTypeLabels(travelPendingType);
      el.travelCustomTypeInput.style.display = travelPendingType === 'other' ? '' : 'none';
      el.travelCustomTypeInput.value = mapped.customType;
    }
  }

  el.scanBtn.addEventListener('click', () => { scanMode = 'expense'; scanFillTarget = 'new'; resetScanModal(); openModal(el.scanModalOverlay); });
  el.aiReadBtn.addEventListener('click', () => { scanMode = 'expense'; scanFillTarget = 'inline'; resetScanModal(); openModal(el.scanModalOverlay); });
  el.travelReadFromPhotoBtn.addEventListener('click', () => { scanMode = 'travel'; scanFillTarget = 'inline'; resetScanModal(); openModal(el.scanModalOverlay); });
  el.scanCameraBtn.addEventListener('click', () => el.scanCameraInput.click());
  el.scanLibraryBtn.addEventListener('click', () => el.scanLibraryInput.click());
  el.scanNoKeySettingsLink.addEventListener('click', () => {
    closeModal(el.scanModalOverlay);
    openSettingsModal();
  });

  async function handleScanFile(file) {
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleImage(raw);
      scanPendingPhoto = small;

      if (!state.settings.apiKey) {
        closeModal(el.scanModalOverlay);
        if (scanMode === 'travel') {
          applyPhotoToTravelForm(small);
          showToast('Photo attached — add an API key in Settings to auto-fill details.');
        } else if (scanFillTarget === 'inline') {
          applyPhotoToOpenExpenseModal(small);
          showToast('Photo attached — add an API key in Settings to auto-fill details.');
        } else {
          openExpenseModal(null, { photo: small });
        }
        return;
      }

      el.scanChooseStep.style.display = 'none';
      el.scanErrorStep.style.display = 'none';
      el.scanLoadingStep.style.display = '';
      el.scanLoadingImg.src = small;

      if (scanMode === 'travel') {
        const parsed = await ClaudeReceipts.parseTravelDocument(small, state.settings.apiKey, todayISO());
        closeModal(el.scanModalOverlay);
        applyParsedToTravelForm(parsed, small);
        const missing = ['name', 'confirmationNumber', 'startAt'].filter((k) => parsed[k] == null);
        showToast(missing.length ? 'Got most of it — check the highlighted fields.' : 'Document read. Review and save.');
        return;
      }

      const parsed = await ClaudeReceipts.parseReceipt(small, state.settings.apiKey);
      closeModal(el.scanModalOverlay);

      if (scanFillTarget === 'inline') {
        applyParsedToOpenExpenseModal(parsed, small);
      } else {
        openExpenseModal(null, {
          photo: small,
          amount: parsed.total != null ? parsed.total : undefined,
          vendor: parsed.vendor || undefined,
          date: parsed.date || undefined,
          category: parsed.category || undefined,
          address: parsed.address || undefined,
        });
      }
      const missing = ['vendor', 'total', 'date', 'category'].filter((k) => parsed[k] == null);
      showToast(missing.length ? 'Got most of it — check the highlighted fields.' : 'Receipt read. Review and save.');
    } catch (e) {
      el.scanChooseStep.style.display = 'none';
      el.scanLoadingStep.style.display = 'none';
      el.scanErrorStep.style.display = '';
      el.scanErrorText.textContent = e.message || 'Something went wrong reading that document.';
    }
  }

  el.scanCameraInput.addEventListener('change', () => { handleScanFile(el.scanCameraInput.files[0]); el.scanCameraInput.value = ''; });
  el.scanLibraryInput.addEventListener('change', () => { handleScanFile(el.scanLibraryInput.files[0]); el.scanLibraryInput.value = ''; });

  el.scanErrorManualBtn.addEventListener('click', () => {
    closeModal(el.scanModalOverlay);
    if (scanMode === 'travel') {
      if (scanPendingPhoto) applyPhotoToTravelForm(scanPendingPhoto);
    } else if (scanFillTarget === 'inline') {
      if (scanPendingPhoto) applyPhotoToOpenExpenseModal(scanPendingPhoto);
    } else {
      openExpenseModal(null, scanPendingPhoto ? { photo: scanPendingPhoto } : null);
    }
  });

  // ---------- settings & trip management ----------
  function renderPastTrips() {
    const past = state.trips
      .filter((t) => t.archivedAt)
      .sort((a, b) => b.archivedAt - a.archivedAt);

    el.pastTripsList.innerHTML = '';

    if (past.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'field-help';
      empty.textContent = 'Banked trips will show up here once you save one.';
      el.pastTripsList.appendChild(empty);
      return;
    }

    for (const trip of past) {
      const tripExpenses = state.allExpenses.filter((e) => e.tripId === trip.id);
      const spent = totalSpent(tripExpenses);
      const dateLabel = trip.startDate
        ? `${fmtShortDate(trip.startDate)}${trip.endDate ? ' – ' + fmtShortDate(trip.endDate) : ''}`
        : new Date(trip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const li = document.createElement('li');
      li.className = 'past-trip-item';
      li.innerHTML = `
        <div class="past-trip-main">
          <div class="past-trip-name">${escapeHtml(trip.name)}</div>
          <div class="past-trip-meta">${dateLabel} · ${tripExpenses.length} expense${tripExpenses.length === 1 ? '' : 's'}</div>
        </div>
        <div class="past-trip-amount">${fmtMoney(spent)}</div>
      `;
      const openThisReport = () => {
        closeModal(el.settingsModalOverlay);
        openReportModal(trip, tripExpenses);
      };
      li.querySelector('.past-trip-main').addEventListener('click', openThisReport);
      li.querySelector('.past-trip-amount').addEventListener('click', openThisReport);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn past-trip-delete';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm(`Delete "${trip.name}" and its ${tripExpenses.length} expense${tripExpenses.length === 1 ? '' : 's'} permanently? This cannot be undone.`)) return;
        for (const e of tripExpenses) await DB.deleteExpense(e.id);
        for (const i of state.allChecklist.filter((c) => c.tripId === trip.id)) await DB.deleteChecklistItem(i.id);
        for (const i of state.allTravelInfo.filter((t) => t.tripId === trip.id)) await DB.deleteTravelInfo(i.id);
        await DB.deleteTrip(trip.id);
        state.allExpenses = state.allExpenses.filter((e) => e.tripId !== trip.id);
        state.allChecklist = state.allChecklist.filter((i) => i.tripId !== trip.id);
        state.allTravelInfo = state.allTravelInfo.filter((i) => i.tripId !== trip.id);
        state.trips = state.trips.filter((t) => t.id !== trip.id);
        renderPastTrips();
        showToast(`Deleted "${trip.name}"`);
      });
      li.appendChild(delBtn);

      el.pastTripsList.appendChild(li);
    }
  }

  function renderCountModeToggle(downBtn, upBtn, mode) {
    downBtn.classList.toggle('selected', mode !== 'countup');
    upBtn.classList.toggle('selected', mode === 'countup');
  }

  function openSettingsModal() {
    el.tripNameInput.value = state.trip.name || '';
    el.budgetInput.value = state.trip.budget != null ? state.trip.budget : '';
    el.apiKeyInput.value = state.settings.apiKey || '';
    el.newTripForm.style.display = 'none';
    pendingTripDates = { start: state.trip.startDate || null, end: state.trip.endDate || null };
    el.tripDatesBtn.textContent = dateRangeLabel(pendingTripDates.start, pendingTripDates.end);
    pendingCountMode = state.trip.countMode === 'countup' ? 'countup' : 'countdown';
    renderCountModeToggle(el.countModeDownBtn, el.countModeUpBtn, pendingCountMode);
    renderPastTrips();
    updateGoogleUI();
    openModal(el.settingsModalOverlay);
  }
  el.settingsBtn.addEventListener('click', openSettingsModal);
  el.menuBtn.addEventListener('click', () => openReportModal());

  el.countModeDownBtn.addEventListener('click', () => {
    pendingCountMode = 'countdown';
    renderCountModeToggle(el.countModeDownBtn, el.countModeUpBtn, pendingCountMode);
  });
  el.countModeUpBtn.addEventListener('click', () => {
    pendingCountMode = 'countup';
    renderCountModeToggle(el.countModeDownBtn, el.countModeUpBtn, pendingCountMode);
  });
  el.newCountModeDownBtn.addEventListener('click', () => {
    pendingNewCountMode = 'countdown';
    renderCountModeToggle(el.newCountModeDownBtn, el.newCountModeUpBtn, pendingNewCountMode);
  });
  el.newCountModeUpBtn.addEventListener('click', () => {
    pendingNewCountMode = 'countup';
    renderCountModeToggle(el.newCountModeDownBtn, el.newCountModeUpBtn, pendingNewCountMode);
  });

  el.tripDatesBtn.addEventListener('click', () => {
    DatePicker.open({
      start: pendingTripDates.start,
      end: pendingTripDates.end,
      onDone: ({ start, end }) => {
        pendingTripDates = { start, end };
        el.tripDatesBtn.textContent = dateRangeLabel(start, end);
      },
    });
  });

  el.newTripDatesBtn.addEventListener('click', () => {
    DatePicker.open({
      start: pendingNewTripDates.start,
      end: pendingNewTripDates.end,
      onDone: ({ start, end }) => {
        pendingNewTripDates = { start, end };
        el.newTripDatesBtn.textContent = dateRangeLabel(start, end);
      },
    });
  });

  el.saveSettingsBtn.addEventListener('click', async () => {
    const budget = parseFloat(el.budgetInput.value);
    const updatedTrip = {
      ...state.trip,
      name: el.tripNameInput.value.trim() || 'Trip Budget',
      budget: isNaN(budget) ? DEFAULT_BUDGET : budget,
      startDate: pendingTripDates.start,
      endDate: pendingTripDates.end,
      countMode: pendingCountMode,
    };
    state.settings.apiKey = el.apiKeyInput.value.trim();

    await DB.putTrip(updatedTrip);
    await DB.setMeta('apiKey', state.settings.apiKey);

    state.trip = updatedTrip;
    const idx = state.trips.findIndex((t) => t.id === updatedTrip.id);
    if (idx >= 0) state.trips[idx] = updatedTrip;

    closeModal(el.settingsModalOverlay);
    renderAll();
    showToast('Settings saved');
  });

  el.resetAllBtn.addEventListener('click', async () => {
    if (!confirm(`Delete all logged expenses for "${state.trip.name}"? This cannot be undone.`)) return;
    const toDelete = activeExpenses();
    for (const e of toDelete) await DB.deleteExpense(e.id);
    state.allExpenses = state.allExpenses.filter((e) => e.tripId !== state.trip.id);
    closeModal(el.settingsModalOverlay);
    renderAll();
    showToast('Trip expenses cleared');
  });

  // ---------- sample data (testing helper) ----------
  function makeSampleReceiptImage(vendor, addr, lines, total) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 60 + lines.length * 24 + 90;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fdfdfb'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111'; ctx.textAlign = 'center';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(vendor.toUpperCase(), canvas.width / 2, 30);
    ctx.font = '11px monospace'; ctx.fillStyle = '#555';
    ctx.fillText(addr, canvas.width / 2, 48);
    ctx.strokeStyle = '#ccc';
    ctx.beginPath(); ctx.moveTo(20, 62); ctx.lineTo(canvas.width - 20, 62); ctx.stroke();
    let y = 84;
    ctx.font = '12px monospace'; ctx.fillStyle = '#222';
    for (const [label, amt] of lines) {
      ctx.textAlign = 'left'; ctx.fillText(label, 24, y);
      ctx.textAlign = 'right'; ctx.fillText(amt, canvas.width - 24, y);
      y += 24;
    }
    ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke();
    y += 26;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left'; ctx.fillText('TOTAL', 24, y);
    ctx.textAlign = 'right'; ctx.fillText(total, canvas.width - 24, y);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  el.loadSampleBtn.addEventListener('click', async () => {
    if (!confirm('Add 8 fake sample expenses (with mock receipt photos) to this trip so you can preview the report? You can clear them afterward with "Clear this trip\'s expenses".')) return;

    const mk = makeSampleReceiptImage;
    const sample = [
      { vendor: 'Shell', category: 'Gas', amount: 52.40, offsetDays: -2,
        photo: mk('Shell', '4821 Peachtree Rd, Atlanta GA', [['Unleaded 14.2gal', '$52.40']], '$52.40') },
      { vendor: 'Waffle House', category: 'Food', amount: 18.75, offsetDays: -2,
        photo: mk('Waffle House', '210 Northside Dr, Atlanta GA', [['All-Star Special', '$9.25'], ['Coffee x2', '$4.50'], ['Tax', '$1.10']], '$18.75') },
      { vendor: 'Extended Stay America', category: 'Lodging', amount: 189.00, offsetDays: -2,
        photo: mk('Extended Stay America', '900 Marietta St, Atlanta GA', [['Room x1 night', '$169.00'], ['Occupancy Tax', '$20.00']], '$189.00') },
      { vendor: 'The Home Depot', category: 'Supplies', amount: 64.32, offsetDays: -1,
        photo: mk('The Home Depot', '1801 Howell Mill Rd, Atlanta GA', [['Gaffer Tape 2x', '$28.50'], ['AA Batteries 24pk', '$19.99'], ['Zip Ties', '$8.83'], ['Tax', '$7.00']], '$64.32') },
      { vendor: 'Subway', category: 'Food', amount: 12.50, offsetDays: -1, photo: null },
      { vendor: 'Uber', category: 'Transport', amount: 23.15, offsetDays: -1, photo: null },
      { vendor: 'Publix', category: 'Food', amount: 87.90, offsetDays: 0,
        photo: mk('Publix', '55 Ivan Allen Jr Blvd, Atlanta GA', [['Craft Services Restock', '$81.40'], ['Tax', '$6.50']], '$87.90') },
      { vendor: 'Shell', category: 'Gas', amount: 48.10, offsetDays: 0,
        photo: mk('Shell', '4821 Peachtree Rd, Atlanta GA', [['Unleaded 13.1gal', '$48.10']], '$48.10') },
    ];

    const today = new Date();
    let createdAt = Date.now();
    for (const s of sample) {
      const d = new Date(today);
      d.setDate(d.getDate() + s.offsetDays);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const expense = {
        id: uid(), tripId: state.trip.id, amount: s.amount, vendor: s.vendor,
        category: s.category, date, photo: s.photo, createdAt: createdAt++,
      };
      await DB.putExpense(expense);
      state.allExpenses.unshift(expense);
    }

    closeModal(el.settingsModalOverlay);
    renderAll();
    showToast('Sample expenses added — try Export Report');
  });

  // ---------- save & bank trip, then start new ----------
  el.startNewTripBtn.addEventListener('click', () => {
    const opening = el.newTripForm.style.display === 'none';
    el.newTripForm.style.display = opening ? '' : 'none';
    if (opening) {
      el.newTripNameInput.value = '';
      el.newTripBudgetInput.value = state.trip.budget || '';
      pendingNewTripDates = { start: null, end: null };
      el.newTripDatesBtn.textContent = dateRangeLabel(null, null);
      pendingNewCountMode = 'countdown';
      renderCountModeToggle(el.newCountModeDownBtn, el.newCountModeUpBtn, pendingNewCountMode);
      el.bankSummaryText.textContent = `Saves your edits above, banks "${state.trip.name}" (${fmtMoney(totalSpent())} of ${fmtMoney(state.trip.budget)}) into Past Trips, then starts a fresh trip with what you enter below.`;
      setTimeout(() => el.newTripNameInput.focus(), 150);
    }
  });
  el.cancelNewTripBtn.addEventListener('click', () => { el.newTripForm.style.display = 'none'; });

  el.confirmNewTripBtn.addEventListener('click', async () => {
    // No name yet is fine — you're often closing out a finished trip without
    // knowing the next one's name yet. Falls back to a generic default you can
    // rename later in Settings whenever the next trip actually comes up.
    const name = el.newTripNameInput.value.trim() || 'Trip Budget';
    const newBudget = parseFloat(el.newTripBudgetInput.value);
    const finalBudget = isNaN(newBudget) ? DEFAULT_BUDGET : newBudget;

    // "Save & Bank Trip" also saves whatever's currently in the Current Trip / API key
    // fields, so nothing typed this session is lost when the trip gets archived.
    const currentBudget = parseFloat(el.budgetInput.value);
    state.settings.apiKey = el.apiKeyInput.value.trim();
    await DB.setMeta('apiKey', state.settings.apiKey);

    const archivedTrip = {
      ...state.trip,
      name: el.tripNameInput.value.trim() || state.trip.name,
      budget: isNaN(currentBudget) ? state.trip.budget : currentBudget,
      startDate: pendingTripDates.start,
      endDate: pendingTripDates.end,
      countMode: pendingCountMode,
      archivedAt: Date.now(),
    };
    await DB.putTrip(archivedTrip);

    const newTrip = {
      id: uid(),
      name,
      budget: finalBudget,
      startDate: pendingNewTripDates.start,
      endDate: pendingNewTripDates.end,
      countMode: pendingNewCountMode,
      createdAt: Date.now(),
      archivedAt: null,
    };
    await DB.putTrip(newTrip);
    await DB.setMeta('activeTripId', newTrip.id);

    const idx = state.trips.findIndex((t) => t.id === archivedTrip.id);
    if (idx >= 0) state.trips[idx] = archivedTrip; else state.trips.push(archivedTrip);
    state.trips.push(newTrip);
    state.trip = newTrip;

    el.newTripForm.style.display = 'none';
    closeModal(el.settingsModalOverlay);
    renderAll();
    showToast(`Banked "${archivedTrip.name}". Started "${newTrip.name}".`);
  });

  // ---------- export: CSV ----------
  function csvEscape(val) {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportCsv(trip = state.trip, expenses = activeExpenses()) {
    if (expenses.length === 0) { showToast('No expenses to export yet.'); return; }
    const rows = [['Date', 'Logged At', 'Vendor', 'Category', 'Amount', 'Counted Toward Budget', 'Location', 'Has Photo']];
    const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    for (const e of sorted) {
      rows.push([e.date, fmtTimestamp(e.createdAt), e.vendor, e.category, e.amount.toFixed(2), e.excludeFromBudget ? 'No' : 'Yes', locationLabel(e), e.photo ? 'Yes' : 'No']);
    }
    const spent = totalSpent(expenses);
    rows.push([]);
    rows.push(['', '', '', 'Starting budget', trip.budget.toFixed(2), '', '', '']);
    rows.push(['', '', '', 'Total spent', spent.toFixed(2), '', '', '']);
    rows.push(['', '', '', 'Remaining', (trip.budget - spent).toFixed(2), '', '', '']);

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    const filename = `${(trip.name || 'trip-budget').replace(/[^a-z0-9]+/gi, '-')}-expenses.csv`;
    downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
    showToast('CSV downloaded');
  }

  $('exportCsvBtn').addEventListener('click', () => exportCsv());
  el.exportReportCsvBtn.addEventListener('click', () => {
    if (currentReportContext) exportCsv(currentReportContext.trip, currentReportContext.expenses);
  });

  // ---------- export: printable report ----------
  function reportItemHtml(e) {
    return `
      <div class="report-item">
        ${e.photo ? `<img src="${e.photo}" alt="Receipt">` : ''}
        <div class="report-item-main">
          <div class="report-item-row">
            <div>
              <div class="report-item-vendor">${escapeHtml(e.vendor || 'Expense')}</div>
              <div class="report-item-meta">${escapeHtml(e.category || 'Other')} · ${e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}${e.excludeFromBudget ? ' · not counted toward budget' : ''}</div>
            </div>
            <div class="report-item-amount">${fmtMoney(e.amount)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function categoryTotals(expenses) {
    const totals = {};
    for (const e of expenses) {
      const cat = e.category || 'Other';
      totals[cat] = (totals[cat] || 0) + e.amount;
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]); // biggest category first
  }

  function reportCategoryBreakdownHtml(expenses) {
    if (expenses.length === 0) return '';
    const rows = categoryTotals(expenses);
    return `
      <div class="report-breakdown">
        <div class="report-section-title">By Category</div>
        ${rows.map(([cat, total]) => `
          <div class="report-breakdown-row">
            <span>${escapeHtml(cat)}</span>
            <span>${fmtMoney(total)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderReportItemsHtml(expenses, mode) {
    if (expenses.length === 0) return '<p style="text-align:center;color:#888;">No expenses logged.</p>';
    const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');

    if (mode === 'category') {
      return categoryTotals(expenses).map(([cat, total]) => `
        <div class="report-group">
          <div class="report-group-header"><span>${escapeHtml(cat)}</span><span>${fmtMoney(total)}</span></div>
          ${expenses.filter((e) => (e.category || 'Other') === cat).sort(byDate).map(reportItemHtml).join('')}
        </div>
      `).join('');
    }
    return [...expenses].sort(byDate).map(reportItemHtml).join('');
  }

  let reportSortMode = 'date';

  function renderReportItemsSection() {
    if (!currentReportContext) return;
    const container = $('reportItemsContainer');
    if (container) container.innerHTML = renderReportItemsHtml(currentReportContext.expenses, reportSortMode);
  }

  function openReportModal(trip = state.trip, expenses = activeExpenses()) {
    currentReportContext = { trip, expenses };
    reportSortMode = 'date';

    const spent = totalSpent(expenses);
    const budget = trip.budget || 0;
    const remaining = budget - spent;
    const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const dateRange = trip.startDate
      ? `${fmtLongDate(trip.startDate)}${trip.endDate ? ' – ' + fmtLongDate(trip.endDate) : ''}`
      : sorted.length
        ? `${fmtShortDate(sorted[0].date)} – ${fmtLongDate(sorted[sorted.length - 1].date)}`
        : '';

    el.reportBody.innerHTML = `
      <div class="report-cover">
        <h1>${escapeHtml(trip.name || 'Trip Budget')}</h1>
        <div class="report-dates">${dateRange}</div>
      </div>
      <div class="report-summary">
        <div><div class="num">${fmtMoney(budget)}</div><div class="lbl">Budget</div></div>
        <div><div class="num">${fmtMoney(spent)}</div><div class="lbl">Spent</div></div>
        <div><div class="num">${fmtMoney(remaining)}</div><div class="lbl">${remaining < 0 ? 'Over' : 'Remaining'}</div></div>
      </div>
      ${reportCategoryBreakdownHtml(expenses)}
      ${expenses.length ? `
        <div class="report-sort-row no-print">
          <span class="report-section-title">Sort</span>
          <div class="report-sort-toggle">
            <button type="button" class="report-sort-btn selected" id="reportSortDateBtn">📅 Date</button>
            <button type="button" class="report-sort-btn" id="reportSortCategoryBtn">🏷️ Category</button>
          </div>
        </div>
      ` : ''}
      <div id="reportItemsContainer">${renderReportItemsHtml(expenses, 'date')}</div>
    `;

    if (expenses.length) {
      $('reportSortDateBtn').addEventListener('click', () => {
        reportSortMode = 'date';
        $('reportSortDateBtn').classList.add('selected');
        $('reportSortCategoryBtn').classList.remove('selected');
        renderReportItemsSection();
      });
      $('reportSortCategoryBtn').addEventListener('click', () => {
        reportSortMode = 'category';
        $('reportSortCategoryBtn').classList.add('selected');
        $('reportSortDateBtn').classList.remove('selected');
        renderReportItemsSection();
      });
    }

    openModal(el.reportModalOverlay);
  }

  $('exportReportBtn').addEventListener('click', () => {
    if (activeExpenses().length === 0) { showToast('No expenses to report yet.'); return; }
    openReportModal();
  });
  el.printReportBtn.addEventListener('click', () => window.print());

  // ---------- travel info ----------
  function fmtDateTimeLocal(val) {
    if (!val) return '';
    return new Date(val).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function renderTravelTypeChips(selected) {
    el.travelTypeChipRow.innerHTML = '';
    for (const type of Object.keys(TRAVEL_TYPE_META)) {
      const meta = TRAVEL_TYPE_META[type];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'category-chip' + (type === selected ? ' selected' : '');
      chip.textContent = `${meta.emoji} ${meta.label}`;
      chip.addEventListener('click', () => {
        travelPendingType = type;
        renderTravelTypeChips(type);
        applyTravelTypeLabels(type);
        el.travelCustomTypeInput.style.display = type === 'other' ? '' : 'none';
        if (type !== 'other') el.travelCustomTypeInput.value = '';
      });
      el.travelTypeChipRow.appendChild(chip);
    }
  }

  function applyTravelTypeLabels(type) {
    const meta = TRAVEL_TYPE_META[type] || TRAVEL_TYPE_META.other;
    el.travelNameLabel.textContent = meta.nameLabel;
    el.travelAddressLabel.textContent = meta.addressLabel;
    el.travelStartLabel.textContent = meta.startLabel;
    el.travelEndLabel.textContent = meta.endLabel;
  }

  function renderTravelInfoList() {
    const items = activeTravelInfo();
    el.travelInfoList.innerHTML = '';
    el.travelInfoEmpty.style.display = items.length ? 'none' : '';

    for (const item of items) {
      const meta = TRAVEL_TYPE_META[item.type] || TRAVEL_TYPE_META.other;
      const typeLabel = item.customType || meta.label;
      const li = document.createElement('li');
      li.className = 'travel-info-item';

      const thumbHtml = item.photo
        ? `<img class="travel-info-thumb" src="${item.photo}" alt="${typeLabel}">`
        : `<div class="travel-info-thumb-fallback">${meta.emoji}</div>`;

      const metaParts = [typeLabel];
      if (item.confirmationNumber) metaParts.push(`#${item.confirmationNumber}`);
      if (item.startAt) metaParts.push(fmtDateTimeLocal(item.startAt));

      li.innerHTML = `
        ${thumbHtml}
        <div class="travel-info-main">
          <div class="travel-info-name">${escapeHtml(item.name || typeLabel)}</div>
          <div class="travel-info-meta">${escapeHtml(metaParts.join(' · '))}</div>
        </div>
      `;
      li.querySelector('.travel-info-main').addEventListener('click', () => openTravelInfoForm(item));
      el.travelInfoList.appendChild(li);
    }
  }

  function openTravelInfoList() {
    el.travelInfoTitle.textContent = 'Travel Info';
    el.travelInfoListView.style.display = '';
    el.travelInfoFormView.style.display = 'none';
    el.travelInfoFormFooter.style.display = 'none';
    renderTravelInfoList();
    openModal(el.travelInfoOverlay);
  }
  el.travelInfoBtn.addEventListener('click', openTravelInfoList);
  el.backTravelInfoBtn.addEventListener('click', openTravelInfoList);

  function openTravelInfoForm(existing = null) {
    travelEditingId = existing ? existing.id : null;
    travelPendingPhoto = existing ? (existing.photo || null) : null;
    travelPendingType = existing ? (existing.type || 'hotel') : 'hotel';

    el.travelInfoTitle.textContent = existing ? 'Edit Travel Info' : 'Add Travel Info';
    el.deleteTravelInfoBtn.style.display = existing ? '' : 'none';

    renderTravelTypeChips(travelPendingType);
    applyTravelTypeLabels(travelPendingType);
    el.travelCustomTypeInput.style.display = travelPendingType === 'other' ? '' : 'none';
    el.travelCustomTypeInput.value = existing ? (existing.customType || '') : '';
    el.travelNameInput.value = existing ? (existing.name || '') : '';
    el.travelConfirmationInput.value = existing ? (existing.confirmationNumber || '') : '';
    el.travelAddressInput.value = existing ? (existing.address || '') : '';
    el.travelStartInput.value = existing ? (existing.startAt || '') : '';
    el.travelEndInput.value = existing ? (existing.endAt || '') : '';
    el.travelNotesInput.value = existing ? (existing.notes || '') : '';

    if (travelPendingPhoto) {
      el.travelPhotoPreviewImg.src = travelPendingPhoto;
      el.travelPhotoPreviewWrap.style.display = '';
      el.travelRemovePhotoBtn.style.display = '';
    } else {
      el.travelPhotoPreviewWrap.style.display = 'none';
      el.travelRemovePhotoBtn.style.display = 'none';
    }

    el.travelInfoListView.style.display = 'none';
    el.travelInfoFormView.style.display = '';
    el.travelInfoFormFooter.style.display = '';
  }
  el.addTravelInfoBtn.addEventListener('click', () => openTravelInfoForm());

  el.travelAttachPhotoBtn.addEventListener('click', () => el.travelPhotoFileInput.click());
  el.travelPhotoFileInput.addEventListener('change', async () => {
    const file = el.travelPhotoFileInput.files[0];
    el.travelPhotoFileInput.value = '';
    if (!file) return;
    try {
      const raw = await fileToDataUrl(file);
      const small = await downscaleImage(raw);
      travelPendingPhoto = small;
      el.travelPhotoPreviewImg.src = small;
      el.travelPhotoPreviewWrap.style.display = '';
      el.travelRemovePhotoBtn.style.display = '';
    } catch (e) {
      showToast(e.message || 'Could not attach that photo.');
    }
  });
  el.travelRemovePhotoBtn.addEventListener('click', () => {
    travelPendingPhoto = null;
    el.travelPhotoPreviewWrap.style.display = 'none';
    el.travelRemovePhotoBtn.style.display = 'none';
  });

  el.saveTravelInfoBtn.addEventListener('click', async () => {
    if (el.saveTravelInfoBtn.disabled) return; // guards against a fast double-tap creating a duplicate
    const name = el.travelNameInput.value.trim();
    if (!name) { showToast('Give it a name.'); el.travelNameInput.focus(); return; }

    el.saveTravelInfoBtn.disabled = true;
    try {
      const existing = travelEditingId ? state.allTravelInfo.find((i) => i.id === travelEditingId) : null;
      const item = {
        id: travelEditingId || uid(),
        tripId: state.trip.id,
        type: travelPendingType,
        customType: travelPendingType === 'other' ? el.travelCustomTypeInput.value.trim() : '',
        name,
        confirmationNumber: el.travelConfirmationInput.value.trim(),
        address: el.travelAddressInput.value.trim(),
        startAt: el.travelStartInput.value || null,
        endAt: el.travelEndInput.value || null,
        notes: el.travelNotesInput.value.trim(),
        photo: travelPendingPhoto || null,
        createdAt: existing ? existing.createdAt : Date.now(),
      };

      await DB.putTravelInfo(item);
      const idx = state.allTravelInfo.findIndex((i) => i.id === item.id);
      if (idx >= 0) state.allTravelInfo[idx] = item; else state.allTravelInfo.push(item);

      showToast(travelEditingId ? 'Travel info updated' : 'Travel info saved');
      openTravelInfoList();
    } finally {
      el.saveTravelInfoBtn.disabled = false;
    }
  });

  el.deleteTravelInfoBtn.addEventListener('click', async () => {
    if (!travelEditingId) return;
    if (!confirm('Delete this travel info?')) return;
    await DB.deleteTravelInfo(travelEditingId);
    state.allTravelInfo = state.allTravelInfo.filter((i) => i.id !== travelEditingId);
    showToast('Travel info deleted');
    openTravelInfoList();
  });

  // ---------- Google Drive backup ----------
  // Backs up to a single JSON file this app creates in the user's own Google Drive
  // (drive.file scope — the app can only ever see files it created, nothing else in
  // their Drive). Never goes through any server; never includes the Anthropic API key.
  const GOOGLE_CLIENT_ID = '324499494473-n0m48riklpl2e1rajniop7v55363ptjf.apps.googleusercontent.com';
  const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const BACKUP_FILENAME = 'quick-budget-backup.json';

  let googleTokenClient = null;
  let googleAccessToken = null;
  let googleAccessTokenExpiresAt = 0;

  function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      setTimeout(initGoogleAuth, 300); // the GIS script loads with `defer`, may not be ready yet
      return;
    }
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: () => {}, // replaced per-call in ensureGoogleAccessToken
    });
  }

  function ensureGoogleAccessToken() {
    return new Promise((resolve, reject) => {
      if (!googleTokenClient) { reject(new Error('Google sign-in isn\'t ready yet — try again in a moment.')); return; }
      if (googleAccessToken && Date.now() < googleAccessTokenExpiresAt - 60000) {
        resolve(googleAccessToken);
        return;
      }
      googleTokenClient.callback = (response) => {
        if (response.error) { reject(new Error(`Google sign-in failed (${response.error}).`)); return; }
        googleAccessToken = response.access_token;
        googleAccessTokenExpiresAt = Date.now() + (response.expires_in * 1000);
        resolve(googleAccessToken);
      };
      googleTokenClient.requestAccessToken({});
    });
  }

  async function updateGoogleUI() {
    const connected = await DB.getMeta('googleConnected', false);
    el.googleSignedOutView.style.display = connected ? 'none' : '';
    el.googleSignedInView.style.display = connected ? '' : 'none';
    if (connected) {
      const lastBackup = await DB.getMeta('lastBackupAt', null);
      el.googleBackupStatus.textContent = lastBackup
        ? `Last backed up ${fmtTimestamp(lastBackup)}`
        : 'Not backed up yet.';
    }
  }

  async function driveFindBackupFile(token) {
    const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not reach Google Drive.');
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  }

  function buildBackupPayload() {
    return {
      version: 1,
      exportedAt: Date.now(),
      activeTripId: state.trip.id,
      trips: state.trips,
      expenses: state.allExpenses,
      checklist: state.allChecklist,
      travelInfo: state.allTravelInfo,
    };
  }

  async function driveUploadBackup(token, fileId, payload) {
    const json = JSON.stringify(payload);
    if (fileId) {
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: json,
      });
      if (!res.ok) throw new Error('Drive upload failed.');
      return res.json();
    }
    const boundary = 'quickbudget' + Date.now();
    const metadata = JSON.stringify({ name: BACKUP_FILENAME, mimeType: 'application/json' });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
      `--${boundary}--`;
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) throw new Error('Drive upload failed.');
    return res.json();
  }

  async function driveDownloadBackup(token, fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not download the backup file.');
    return res.json();
  }

  async function restoreFromBackupPayload(payload) {
    if (!payload || !Array.isArray(payload.trips)) throw new Error('That backup file looks invalid.');

    const currentExpenses = await DB.getAllExpenses();
    for (const e of currentExpenses) await DB.deleteExpense(e.id);
    const currentChecklist = await DB.getAllChecklistItems();
    for (const i of currentChecklist) await DB.deleteChecklistItem(i.id);
    const currentTravelInfo = await DB.getAllTravelInfo();
    for (const i of currentTravelInfo) await DB.deleteTravelInfo(i.id);
    const currentTrips = await DB.getAllTrips();
    for (const t of currentTrips) await DB.deleteTrip(t.id);

    for (const t of payload.trips) await DB.putTrip(t);
    for (const e of payload.expenses || []) await DB.putExpense(e);
    for (const i of payload.checklist || []) await DB.putChecklistItem(i);
    for (const i of payload.travelInfo || []) await DB.putTravelInfo(i);
    if (payload.activeTripId) await DB.setMeta('activeTripId', payload.activeTripId);

    const { trips, activeTrip } = await loadTripsAndActive();
    state.trips = trips;
    state.trip = activeTrip;
    state.allExpenses = await DB.getAllExpenses();
    state.allChecklist = await DB.getAllChecklistItems();
    state.allTravelInfo = await DB.getAllTravelInfo();
    renderAll();
  }

  el.googleSignInBtn.addEventListener('click', async () => {
    try {
      await ensureGoogleAccessToken();
      await DB.setMeta('googleConnected', true);
      await updateGoogleUI();
      showToast('Connected to Google');
    } catch (e) {
      showToast(e.message || 'Google sign-in failed.');
    }
  });

  el.driveBackupBtn.addEventListener('click', async () => {
    if (el.driveBackupBtn.disabled) return;
    el.driveBackupBtn.disabled = true;
    try {
      const token = await ensureGoogleAccessToken();
      const existing = await driveFindBackupFile(token);
      await driveUploadBackup(token, existing ? existing.id : null, buildBackupPayload());
      await DB.setMeta('lastBackupAt', Date.now());
      await updateGoogleUI();
      showToast('Backed up to Google Drive');
    } catch (e) {
      showToast(e.message || 'Backup failed.');
    } finally {
      el.driveBackupBtn.disabled = false;
    }
  });

  el.driveRestoreBtn.addEventListener('click', async () => {
    if (el.driveRestoreBtn.disabled) return;
    if (!confirm('This replaces ALL trip data currently on this device with your Google Drive backup. This cannot be undone. Continue?')) return;
    el.driveRestoreBtn.disabled = true;
    try {
      const token = await ensureGoogleAccessToken();
      const file = await driveFindBackupFile(token);
      if (!file) { showToast('No backup found in Google Drive yet.'); return; }
      const payload = await driveDownloadBackup(token, file.id);
      await restoreFromBackupPayload(payload);
      closeModal(el.settingsModalOverlay);
      showToast('Restored from Google Drive');
    } catch (e) {
      showToast(e.message || 'Restore failed.');
    } finally {
      el.driveRestoreBtn.disabled = false;
    }
  });

  el.googleSignOutBtn.addEventListener('click', async () => {
    if (googleAccessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(googleAccessToken, () => {});
    }
    googleAccessToken = null;
    googleAccessTokenExpiresAt = 0;
    await DB.setMeta('googleConnected', false);
    await updateGoogleUI();
    showToast('Disconnected from Google');
  });

  // ---------- init ----------
  async function loadTripsAndActive() {
    const trips = await DB.getAllTrips();
    const activeTripId = await DB.getMeta('activeTripId', null);
    let activeTrip = trips.find((t) => t.id === activeTripId && !t.archivedAt);

    if (!activeTrip) {
      // First run, or pre-multi-trip data: migrate legacy single-trip settings if present.
      const legacyName = await DB.getMeta('tripName', null);
      const legacyBudget = await DB.getMeta('budget', null);
      activeTrip = {
        id: uid(),
        name: legacyName || 'Trip Budget',
        budget: legacyBudget != null ? legacyBudget : DEFAULT_BUDGET,
        createdAt: Date.now(),
        archivedAt: null,
      };
      await DB.putTrip(activeTrip);
      await DB.setMeta('activeTripId', activeTrip.id);
      trips.push(activeTrip);

      const allExpenses = await DB.getAllExpenses();
      const untagged = allExpenses.filter((e) => !e.tripId);
      for (const e of untagged) {
        e.tripId = activeTrip.id;
        await DB.putExpense(e);
      }
    }

    return { trips, activeTrip };
  }

  async function init() {
    state.settings.apiKey = await DB.getMeta('apiKey', '');
    const { trips, activeTrip } = await loadTripsAndActive();
    state.trips = trips;
    state.trip = activeTrip;
    state.allExpenses = await DB.getAllExpenses();
    state.allChecklist = await DB.getAllChecklistItems();
    state.allTravelInfo = await DB.getAllTravelInfo();

    renderAll();
    initGoogleAuth();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  init().catch((err) => {
    console.error('init failed', err);
    showToast(err.message || 'Could not load your trip data.', 6000);
  });
})();
