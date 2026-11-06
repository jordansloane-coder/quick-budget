// Saturation.io hand-off: an API client (projects, manual transactions, receipt upload)
// plus a no-dependency .zip builder used as the "package" fallback.
// Self-contained on purpose — no app globals — so it can be reused by a sibling app.
//
// API docs: https://docs.saturation.io  (OpenAPI: /openapi.yaml)

const Saturation = (() => {
  // Saturation's server doesn't send CORS headers, so a browser can't call it directly.
  // API_BASE points at a small relay that forwards requests and adds them. Change it here
  // (one place) if the relay ever moves.
  const API_BASE = 'https://next-api.saturation.io/v1';
  const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // Saturation Wallet's per-file limit

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const slug = (s) => (s || '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const cents = (n) => Math.round(Number(n) * 100);
  const extForMime = (mime) => (/png/i.test(mime) ? 'png' : /pdf/i.test(mime) ? 'pdf' : /heic/i.test(mime) ? 'heic' : 'jpg');

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  // 2026-11-05_ABC-Restaurant_47.00.jpg  (unique within `used`)
  function receiptFileName(e, mime, used, suffix = '') {
    const base = [e.date || '', slug(e.vendor) || 'receipt', Number(e.amount).toFixed(2)].filter(Boolean).join('_') + suffix;
    const ext = extForMime(mime);
    let name = `${base}.${ext}`;
    let i = 2;
    while (used.has(name)) name = `${base}_${i++}.${ext}`;
    used.add(name);
    return name;
  }

  // What the Saturation team sees as the transaction description.
  function describe(e) {
    const parts = [e.vendor, e.category, e.reportNote].filter(Boolean);
    // "Mileage - Mileage" reads badly; drop a part that repeats an earlier one.
    return parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(' - ');
  }

  // ---------- API client ----------
  class SaturationError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }

  async function call(key, method, path, { json, form, idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${key}` };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    let body;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    else if (form) body = form;

    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(API_BASE + path, { method, headers, body });
      } catch (err) {
        throw new SaturationError(
          "Couldn't reach Saturation from the browser. Check your connection — or use the Saturation zip option instead.",
          'network'
        );
      }
      if (res.status === 429 && attempt < 2) {
        const wait = Math.min(Number(res.headers.get('Retry-After')) || 2, 10);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      break;
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    if (!res.ok) {
      if (res.status === 401) throw new SaturationError('Saturation rejected the API key. Paste a fresh one in Settings.', 'auth');
      if (res.status === 403) throw new SaturationError("That API key doesn't have access to this. Ask Pat to check the key's permissions.", 'forbidden');
      throw new SaturationError((data && data.message) || `Saturation error (${res.status}).`, (data && data.code) || String(res.status));
    }
    return data;
  }

  // All projects the key can see, paged.
  async function listProjects(key) {
    const out = [];
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const q = `?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
      const data = await call(key, 'GET', '/projects' + q);
      out.push(...(data.data || []));
      cursor = data.nextCursor || '';
      if (!cursor) break;
    }
    return out;
  }

  // Match what was typed to a project: exact name, then slug, then a single "contains" match.
  function matchProject(projects, typed) {
    const t = (typed || '').trim().toLowerCase();
    if (!t) return { project: null, reason: 'empty' };
    const exact = projects.filter((p) => p.name.toLowerCase() === t || (p.slug || '').toLowerCase() === t);
    if (exact.length === 1) return { project: exact[0] };
    const partial = projects.filter((p) => p.name.toLowerCase().includes(t));
    if (partial.length === 1) return { project: partial[0] };
    return { project: null, reason: partial.length > 1 || exact.length > 1 ? 'ambiguous' : 'none', candidates: partial };
  }

  // Sends one expense: creates a manual transaction, then attaches its photo(s).
  // `e.saturation` remembers what already went through, so re-sending never duplicates:
  //   { projectId, txnId, docIds: { photo, photo2 } }
  // Calls onSaved(e) after each durable step so the caller can persist progress.
  async function sendExpense(key, project, e, { tripName = '', location = '', onSaved = async () => {} } = {}) {
    const prior = e.saturation && e.saturation.projectId === project.id ? e.saturation : null;
    const sat = prior || { projectId: project.id, txnId: '', docIds: {} };

    if (!sat.txnId) {
      const notes = [
        tripName && `Trip: ${tripName}`,
        e.reimbursement && 'Reimbursement',
        e.companyExpense && 'Company expense',
        e.miles != null && `${e.miles} miles`,
        location && `Location: ${location}`,
        'Sent from Quick Budget',
      ].filter(Boolean).join('\n');
      const txn = await call(key, 'POST', '/transactions', {
        idempotencyKey: `qb-txn-${e.id}-${project.id}`,
        json: {
          type: 'CreditCard',
          amount: { amount: cents(e.amount), currency: 'USD' },
          timestamp: `${e.date}T12:00:00.000Z`, // midday UTC so the date can't slip a day
          description: describe(e),
          projectId: project.id,
          notes,
        },
      });
      sat.txnId = txn.id;
      e.saturation = sat;
      await onSaved(e);
    }

    const used = new Set();
    const photos = [['photo', e.photo, ''], ['photo2', e.photo2, '_after']];
    for (const [field, dataUrl, suffix] of photos) {
      if (!dataUrl || sat.docIds[field]) continue;
      const blob = await dataUrlToBlob(dataUrl);
      if (blob.size > MAX_RECEIPT_BYTES) {
        throw new SaturationError(`The photo for ${e.vendor} is over 5 MB, which is Saturation's limit.`, 'too_big');
      }
      const name = receiptFileName(e, blob.type, used, suffix);
      const form = new FormData();
      form.append('file', blob, name);
      form.append('metadata', JSON.stringify({ name, links: { kind: 'transaction', id: sat.txnId } }));
      const doc = await call(key, 'POST', '/documents', { form, idempotencyKey: `qb-doc-${e.id}-${field}-${sat.txnId}` });
      sat.docIds[field] = doc.id;
      e.saturation = sat;
      await onSaved(e);
    }
    return sat;
  }

  // ---------- zip package (fallback / "drag the folder in yourself") ----------
  const enc = new TextEncoder();
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // files: [{ name, data: Uint8Array }] -> store-only (uncompressed) zip Blob
  function buildZip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const crc = crc32(f.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8 names
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, f.data.length, true);
      local.setUint32(22, f.data.length, true);
      local.setUint16(26, nameBytes.length, true);
      parts.push(local.buffer, nameBytes, f.data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, f.data.length, true);
      cd.setUint32(24, f.data.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint32(42, offset, true);
      central.push(cd.buffer, nameBytes);
      offset += 30 + nameBytes.length + f.data.length;
    }
    const cdSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  const csvCell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // A folder-in-a-zip: receipts/ (renamed so each file identifies itself) + expenses.csv
  async function buildPackage(expenses, { projectName = '' } = {}) {
    const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const used = new Set();
    const files = [];
    const rows = [['date', 'vendor', 'amount', 'description', 'category', 'reimbursement', 'company_expense', 'project', 'receipt_file']];
    for (const e of sorted) {
      const names = [];
      for (const [dataUrl, suffix] of [[e.photo, ''], [e.photo2, '_after']]) {
        if (!dataUrl) continue;
        const blob = await dataUrlToBlob(dataUrl);
        const name = receiptFileName(e, blob.type, used, suffix);
        files.push({ name: `receipts/${name}`, data: new Uint8Array(await blob.arrayBuffer()) });
        names.push(name);
      }
      rows.push([
        e.date, e.vendor, Number(e.amount).toFixed(2), describe(e), e.category,
        e.reimbursement ? 'Yes' : '', e.companyExpense ? 'Yes' : '', projectName, names.join('; '),
      ]);
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    files.unshift({ name: 'expenses.csv', data: enc.encode(csv) });
    return buildZip(files);
  }

  return { listProjects, matchProject, sendExpense, buildPackage, SaturationError, MAX_RECEIPT_BYTES };
})();
