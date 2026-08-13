// Thin client for calling the Claude API directly from the browser to read photos of
// receipts and travel documents. Requires the user's own Anthropic API key
// (console.anthropic.com) — separate from a claude.ai subscription.

const ClaudeReceipts = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-sonnet-5';

  const RECEIPT_SYSTEM_PROMPT = `You read photos of paper/printed receipts for a film crew member tracking a per-diem travel budget.
Extract the vendor name, the FINAL total amount charged (not subtotal, include tax/tip if shown), the date, the printed store address/location if the receipt shows one, and guess a spending category.
Respond with ONLY raw JSON, no markdown fences, no commentary, matching exactly this shape:
{"vendor": string|null, "total": number|null, "date": "YYYY-MM-DD"|null, "category": string|null, "address": string|null}
Category must be one of: "Food", "Groceries", "Gas", "Lodging", "Supplies", "Transport", "Other" — pick your best guess.
"Groceries" is for grocery/supermarket shopping (Publix, Kroger, Trader Joe's, Whole Foods, etc.) — use "Food" for restaurants, takeout, and other prepared food instead.
"address" is whatever street address / city / location text is printed on the receipt itself (often near the top, under the store name) — not a guess, only what's actually legible on the page.
If a field truly cannot be determined from the image, use null for it. Never fabricate a value.`;

  const TRAVEL_SYSTEM_PROMPT = `You read photos of travel documents for a traveler organizing their trip: hotel confirmations, flight boarding passes or e-tickets, car rental agreements, train tickets, event tickets, or any other travel booking.
Extract: the type of document (a short label like "Hotel", "Flight", "Car Rental", "Train", "Insurance", "Event Ticket" — whatever best fits, your own words, not a fixed list), the provider/company name, the confirmation or booking number, the relevant address or location, the start and end date+time (check-in/check-out for a hotel, departure/arrival for a flight, pick-up/drop-off for a car rental — whatever is printed), and any other useful details as notes (flight number, seat, terminal, gate, room type, car class, etc.).
Respond with ONLY raw JSON, no markdown fences, no commentary, matching exactly this shape:
{"type": string|null, "name": string|null, "confirmationNumber": string|null, "address": string|null, "startAt": "YYYY-MM-DDTHH:mm"|null, "endAt": "YYYY-MM-DDTHH:mm"|null, "notes": string|null}
"startAt"/"endAt" must be in 24-hour local "YYYY-MM-DDTHH:mm" format with no timezone suffix, matching whatever date/time is printed on the document — if only a date is shown with no time, use "00:00" for the time part. If a year isn't printed, infer it from context near the reference date given below.
If a field truly cannot be determined from the image, use null for it. Never fabricate a value.`;

  function stripDataUrlPrefix(dataUrl) {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(dataUrl);
    if (!match) throw new Error('Unexpected image format.');
    return { mediaType: match[1], base64: match[2] };
  }

  function extractJson(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1] : text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Could not find JSON in Claude\'s response.');
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function callClaudeVision(imageDataUrl, apiKey, systemPrompt, userText) {
    if (!apiKey) throw new Error('NO_API_KEY');
    const { mediaType, base64 } = stripDataUrlPrefix(imageDataUrl);

    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                { type: 'text', text: userText },
              ],
            },
          ],
        }),
      });
    } catch (networkErr) {
      throw new Error('Could not reach Claude — check your internet connection and try again.');
    }

    if (res.status === 401) throw new Error('That API key was rejected. Double-check it in Settings.');
    if (res.status === 429) throw new Error('Rate limited by the API — wait a moment and try again.');
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Claude API error (${res.status}). ${body.slice(0, 140)}`);
    }

    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Claude did not return readable text.');

    try {
      return extractJson(textBlock.text);
    } catch (e) {
      throw new Error('Could not understand Claude\'s response — try entering the details manually.');
    }
  }

  return {
    async parseReceipt(imageDataUrl, apiKey) {
      const parsed = await callClaudeVision(
        imageDataUrl, apiKey, RECEIPT_SYSTEM_PROMPT,
        'Read this receipt and return the JSON described in your instructions.'
      );
      return {
        vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
        total: typeof parsed.total === 'number' ? parsed.total : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        category: typeof parsed.category === 'string' ? parsed.category : null,
        address: typeof parsed.address === 'string' ? parsed.address : null,
      };
    },

    async parseTravelDocument(imageDataUrl, apiKey, todayIso) {
      const parsed = await callClaudeVision(
        imageDataUrl, apiKey, TRAVEL_SYSTEM_PROMPT,
        `Read this travel document and return the JSON described in your instructions. Today's date is ${todayIso}, in case you need it to infer a missing year.`
      );
      return {
        type: typeof parsed.type === 'string' ? parsed.type : null,
        name: typeof parsed.name === 'string' ? parsed.name : null,
        confirmationNumber: typeof parsed.confirmationNumber === 'string' ? parsed.confirmationNumber : null,
        address: typeof parsed.address === 'string' ? parsed.address : null,
        startAt: typeof parsed.startAt === 'string' ? parsed.startAt : null,
        endAt: typeof parsed.endAt === 'string' ? parsed.endAt : null,
        notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      };
    },
  };
})();
