import { useState, useEffect, useRef, useMemo } from 'react';
import {
  saveSession,
  updateSession,
  deleteSession,
  getSession,
  getAllSessions,
  getTodaySessions,
  getSessionsByClientKey,
  searchClients,
  getAllClients,
  findClient,
  exportAllData,
  getInventory,
  getProduct,
  findProductByName,
  addProduct,
  updateProduct,
  deleteProduct,
  applyStockDelta,
  getLowStockProducts,
  getOutOfStockProducts,
  getProductSalesReport,
  PRODUCT_CATEGORIES,
} from '../services/notesStorage.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PASSWORD = 'freshface2026';
const SESSION_KEY = 'ffs_notes_auth';

const TREATMENTS = [
  'Classic Facial',
  'Custom Facial',
  'Back Facial',
  'Chemical Peel',
  'Microneedling',
  'Nanoneedling LuminFusion',
  'MicroPeel',
  'Dermaplaning',
  'Microdermabrasion Add-On',
  'Lash Lift & Tint',
  'Brow Lamination & Tint',
  'Brow Tint',
  'Brow Lamination',
  'Lip Wax',
  'Brow Wax',
];

const PRODUCTS = [
  'PreCleanse',
  'Special Cleansing Gel',
  'Daily Microfoliant',
  'BioLumin-C Serum',
  'Multivitamin Power Recovery Masque',
  'Dynamic Skin Recovery SPF50',
  'AGE Bright Clearing Serum',
  'Phyto Nature Firming Serum',
  'Intensive Moisture Balance',
  'Skin Smoothing Cream',
  'Calm Water Gel',
  'Barrier Repair',
  'Retinol Clearing Oil',
];

const SKIN_CONCERNS = [
  'Acne / Breakouts',
  'Aging / Fine Lines / Wrinkles',
  'Hyperpigmentation / Dark Spots',
  'Sun Damage',
  'Dryness / Dehydration',
  'Oiliness / Excess Sebum',
  'Sensitivity / Redness / Rosacea',
  'Large Pores',
  'Uneven Texture',
  'Melasma',
  'Scarring (acne or other)',
  'Dullness / Lack of Radiance',
  'Under-eye Concerns',
  'Neck/Décolleté Concerns',
];

const NEXT_TREATMENTS = [
  'Classic Facial',
  'Custom Facial',
  'Chemical Peel',
  'Microneedling',
  'Nanoneedling LuminFusion',
  'MicroPeel',
  'Dermaplaning',
  'Back Facial',
  'Lash Lift & Tint',
  'Brow Services',
];

const TIMING_OPTIONS = [
  { value: '2w', label: 'Come back in 2 weeks' },
  { value: '4w', label: 'Come back in 4 weeks' },
  { value: '6w', label: 'Come back in 6 weeks' },
  { value: '8w', label: 'Come back in 8 weeks' },
  { value: 'asneeded', label: 'As needed' },
  { value: 'custom', label: 'Custom' },
];

const PAYMENT_METHODS = [
  { value: 'card', label: 'Card (Stripe)' },
  { value: 'cash', label: 'Cash' },
  { value: 'next_booking', label: 'Added to next booking' },
  { value: 'complimentary', label: 'Complimentary (sample)' },
];

function currency(n) {
  const v = Number(n || 0);
  return `$${v.toFixed(2)}`;
}

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function todayFriendly() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Password Gate ───────────────────────────────────────────────────────────

function PasswordGate({ onAuth }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      onAuth();
    } else {
      setError(true);
      setValue('');
      setTimeout(() => setError(false), 3000);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="nt-gate">
      <div className="nt-gate__card">
        <div className="nt-gate__logo">Fresh Face Studio</div>
        <p className="nt-gate__subtitle">Client Notes — Private Access</p>
        <form className="nt-gate__form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            className={`nt-gate__input${error ? ' nt-gate__input--error' : ''}`}
            placeholder="Enter password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            autoComplete="current-password"
          />
          <button type="submit" className="nt-btn nt-btn--primary nt-btn--full">Enter</button>
        </form>
        {error && <p className="nt-gate__error">Incorrect password. Please try again.</p>}
      </div>
    </div>
  );
}

// ─── Photo Uploader ──────────────────────────────────────────────────────────

function PhotoUploader({ label, photos, onAdd, onRemove, onPreview }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const data = await fileToBase64(file);
        onAdd({ data, caption: '' });
      } catch (err) {
        console.error('Photo read failed:', err);
      }
    }
  }

  return (
    <div className="nt-photos">
      <div className="nt-photos__header">
        <label className="nt-photos__label">{label}</label>
        <div className="nt-photos__actions">
          <button
            type="button"
            className="nt-photo-btn"
            onClick={() => cameraRef.current?.click()}
            aria-label={`Take ${label} photo with camera`}
          >
            <span aria-hidden="true">📷</span> Camera
          </button>
          <button
            type="button"
            className="nt-photo-btn"
            onClick={() => galleryRef.current?.click()}
            aria-label={`Choose ${label} from gallery`}
          >
            <span aria-hidden="true">🖼️</span> Gallery
          </button>
        </div>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        style={{ display: 'none' }}
      />
      {photos.length > 0 && (
        <div className="nt-photos__strip">
          {photos.map((p, idx) => (
            <div key={idx} className="nt-thumb">
              <img
                src={p.data}
                alt={`${label} ${idx + 1}`}
                onClick={() => onPreview(p.data)}
              />
              <button
                type="button"
                className="nt-thumb__remove"
                aria-label="Remove photo"
                onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Checkbox Group ──────────────────────────────────────────────────────────

function CheckboxGroup({ options, selected, onToggle, columns = 1 }) {
  return (
    <div className={`nt-checks nt-checks--cols-${columns}`}>
      {options.map((opt) => {
        const isOn = selected.includes(opt);
        return (
          <label
            key={opt}
            className={`nt-check${isOn ? ' nt-check--on' : ''}`}
          >
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => onToggle(opt)}
            />
            <span className="nt-check__box" aria-hidden="true">
              {isOn && '✓'}
            </span>
            <span className="nt-check__label">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

// ─── New / Edit Session Form ─────────────────────────────────────────────────

function SessionForm({ existing, onSaved, onCancel }) {
  const [clientName, setClientName] = useState(existing?.clientName || '');
  const [clientEmail, setClientEmail] = useState(existing?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(existing?.clientPhone || '');
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState(existing?.photos || { before: [], after: [], treatment: [] });
  const [treatmentsPerformed, setTreatmentsPerformed] = useState(existing?.treatmentsPerformed || []);
  const [productsUsed, setProductsUsed] = useState(existing?.productsUsed || []);
  const [otherProduct, setOtherProduct] = useState('');
  const [skinConcerns, setSkinConcerns] = useState(existing?.skinConcerns || []);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [recommendedNextTreatment, setRecommendedNextTreatment] = useState(existing?.recommendedNextTreatment || '');
  const [recommendedProducts, setRecommendedProducts] = useState(existing?.recommendedProducts || []);
  const [nextAppointmentTiming, setNextAppointmentTiming] = useState(existing?.nextAppointmentTiming || '');
  const [nextAppointmentCustom, setNextAppointmentCustom] = useState(existing?.nextAppointmentCustom || '');
  const [productsSold, setProductsSold] = useState(() => {
    // Map existing sold lines into form-friendly shape (keyed by productId)
    const initial = {};
    for (const line of existing?.productsSold || []) {
      if (line.productId) {
        initial[line.productId] = {
          productId: line.productId,
          name: line.name,
          quantity: Number(line.quantity || 1),
          unitPrice: Number(line.unitPrice || 0),
        };
      }
    }
    return initial;
  });
  const [productSalePaymentMethod, setProductSalePaymentMethod] = useState(
    existing?.productSalePaymentMethod || ''
  );
  const [stockWarning, setStockWarning] = useState(null); // { message, onConfirm }
  const [error, setError] = useState('');
  const [previewImg, setPreviewImg] = useState(null);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const allClients = useMemo(() => (typeof window !== 'undefined' ? getAllClients() : []), []);
  const inventory = useMemo(
    () => (typeof window !== 'undefined' ? getInventory() : []),
    []
  );

  // Autocomplete on name
  useEffect(() => {
    if (!clientName || clientName.length < 2) {
      setNameSuggestions([]);
      return;
    }
    const q = clientName.toLowerCase();
    const matches = allClients
      .filter((c) => (c.name || '').toLowerCase().includes(q))
      .slice(0, 5);
    setNameSuggestions(matches);
  }, [clientName, allClients]);

  // Auto-fill email when name matches
  useEffect(() => {
    if (existing) return;
    if (!clientName || clientEmail) return;
    const match = findClient(clientName, '');
    if (match) {
      if (match.email) setClientEmail(match.email);
      if (match.phone) setClientPhone(match.phone);
    }
  }, [clientName]); // eslint-disable-line

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function addPhoto(section, photo) {
    setPhotos((p) => ({ ...p, [section]: [...(p[section] || []), photo] }));
  }
  function removePhoto(section, idx) {
    setPhotos((p) => ({ ...p, [section]: p[section].filter((_, i) => i !== idx) }));
  }

  function pickSuggestion(client) {
    setClientName(client.name || '');
    setClientEmail(client.email || '');
    setClientPhone(client.phone || '');
    setShowSuggestions(false);
  }

  // Build the final productsSold array from the form state (qty > 0 only).
  function buildSoldLines() {
    const lines = [];
    for (const entry of Object.values(productsSold)) {
      const qty = Number(entry.quantity || 0);
      if (qty <= 0) continue;
      const unit = Number(entry.unitPrice || 0);
      lines.push({
        productId: entry.productId,
        name: entry.name,
        quantity: qty,
        unitPrice: unit,
        lineTotal: +(qty * unit).toFixed(2),
        paymentMethod: productSalePaymentMethod,
      });
    }
    return lines;
  }

  const soldLinesPreview = buildSoldLines();
  const productSaleTotal = +soldLinesPreview
    .reduce((sum, l) => sum + l.lineTotal, 0)
    .toFixed(2);

  function doSave(soldLines, total) {
    // Include "Other" product if filled
    const finalProducts = otherProduct.trim()
      ? [...productsUsed, `Other: ${otherProduct.trim()}`]
      : productsUsed;

    const payload = {
      id: existing?.id,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      date,
      createdAt: existing?.createdAt,
      photos,
      treatmentsPerformed,
      productsUsed: finalProducts,
      skinConcerns,
      notes: notes.trim(),
      recommendedNextTreatment,
      recommendedProducts,
      nextAppointmentTiming,
      nextAppointmentCustom: nextAppointmentTiming === 'custom' ? nextAppointmentCustom.trim() : '',
      productsSold: soldLines,
      productSaleTotal: total,
      productSalePaymentMethod: soldLines.length > 0 ? productSalePaymentMethod : '',
    };

    // Apply stock delta (new lines - old lines).
    // For new sessions: oldLines = [], so stock decrements by full new qty.
    const oldLines = existing?.productsSold || [];
    if (soldLines.length > 0 || oldLines.length > 0) {
      applyStockDelta(oldLines, soldLines);
    }

    const saved = existing
      ? updateSession(existing.id, payload)
      : saveSession(payload);
    onSaved(saved);
  }

  function handleSave() {
    setError('');
    if (!clientName.trim()) {
      setError('Please enter a client name.');
      return;
    }
    if (treatmentsPerformed.length === 0) {
      setError('Please select at least one treatment performed.');
      return;
    }

    const soldLines = buildSoldLines();
    const total = +soldLines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2);

    if (soldLines.length > 0 && !productSalePaymentMethod) {
      setError('Please select a payment method for the product sale.');
      return;
    }

    // Stock warning: check if any sale will bring product stock to 0 or below.
    // We calc: currentStock - delta. Delta = (newQty in this session) - (oldQty already recorded).
    const oldMap = new Map();
    for (const line of existing?.productsSold || []) {
      if (!line.productId) continue;
      oldMap.set(line.productId, (oldMap.get(line.productId) || 0) + Number(line.quantity || 0));
    }
    const willGoOut = [];
    for (const line of soldLines) {
      if (!line.productId) continue;
      const prod = getProduct(line.productId);
      if (!prod) continue;
      const delta = line.quantity - (oldMap.get(line.productId) || 0);
      const resulting = Number(prod.stock || 0) - delta;
      if (delta > 0 && resulting <= 0) {
        willGoOut.push({ name: prod.name, resulting: Math.max(0, resulting) });
      }
    }

    if (willGoOut.length > 0) {
      const msg =
        willGoOut.length === 1
          ? `⚠️ This will put ${willGoOut[0].name} out of stock. Continue?`
          : `⚠️ This will put the following products out of stock: ${willGoOut.map((p) => p.name).join(', ')}. Continue?`;
      setStockWarning({
        message: msg,
        onConfirm: () => { setStockWarning(null); doSave(soldLines, total); },
      });
      return;
    }

    doSave(soldLines, total);
  }

  function toggleSoldProduct(product) {
    setProductsSold((prev) => {
      const copy = { ...prev };
      if (copy[product.id]) {
        delete copy[product.id];
      } else {
        copy[product.id] = {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.retailPrice || 0),
        };
      }
      return copy;
    });
  }

  function updateSoldLine(productId, field, value) {
    setProductsSold((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  }

  return (
    <div className="nt-form">
      {previewImg && (
        <div className="nt-lightbox" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="Preview" />
          <button type="button" className="nt-lightbox__close" aria-label="Close preview">×</button>
        </div>
      )}

      <div className="nt-form__head">
        <h2>{existing ? 'Edit Session' : 'New Session'}</h2>
        <button type="button" className="nt-btn nt-btn--ghost nt-btn--sm" onClick={onCancel}>Cancel</button>
      </div>

      {/* Client Info */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Client Info</h3>
        <div className="nt-field nt-field--autocomplete">
          <label>Client Name *</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => { setClientName(e.target.value); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Jane Doe"
          />
          {showSuggestions && nameSuggestions.length > 0 && (
            <ul className="nt-suggestions">
              {nameSuggestions.map((c) => (
                <li key={c.key}>
                  <button type="button" onClick={() => pickSuggestion(c)}>
                    <strong>{c.name}</strong>
                    {c.email && <span> — {c.email}</span>}
                    <em> ({c.totalVisits} visit{c.totalVisits === 1 ? '' : 's'})</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="nt-field">
          <label>Email</label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="jane@example.com"
            autoComplete="off"
          />
        </div>
        <div className="nt-field">
          <label>Phone</label>
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="(843) 555-1234"
            autoComplete="off"
          />
        </div>
        <div className="nt-field">
          <label>Session Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </section>

      {/* Photos */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Photos</h3>
        <PhotoUploader
          label="Before Photos"
          photos={photos.before || []}
          onAdd={(p) => addPhoto('before', p)}
          onRemove={(i) => removePhoto('before', i)}
          onPreview={setPreviewImg}
        />
        <PhotoUploader
          label="After Photos"
          photos={photos.after || []}
          onAdd={(p) => addPhoto('after', p)}
          onRemove={(i) => removePhoto('after', i)}
          onPreview={setPreviewImg}
        />
        <PhotoUploader
          label="Treatment Area Photos"
          photos={photos.treatment || []}
          onAdd={(p) => addPhoto('treatment', p)}
          onRemove={(i) => removePhoto('treatment', i)}
          onPreview={setPreviewImg}
        />
      </section>

      {/* Treatments Performed */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Treatment Performed *</h3>
        <CheckboxGroup
          options={TREATMENTS}
          selected={treatmentsPerformed}
          onToggle={(v) => toggle(treatmentsPerformed, setTreatmentsPerformed, v)}
        />
      </section>

      {/* Products Used */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Products Used</h3>
        <CheckboxGroup
          options={PRODUCTS}
          selected={productsUsed}
          onToggle={(v) => toggle(productsUsed, setProductsUsed, v)}
        />
        <div className="nt-field nt-field--other">
          <label>Other Product</label>
          <input
            type="text"
            value={otherProduct}
            onChange={(e) => setOtherProduct(e.target.value)}
            placeholder="Enter product name"
          />
        </div>
      </section>

      {/* Products Sold This Session */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Products Sold This Session</h3>
        {inventory.length === 0 && (
          <p className="nt-empty" style={{ padding: '8px 0' }}>
            No products in inventory yet. Add products in the Inventory tab first.
          </p>
        )}
        {inventory.length > 0 && (
          <div className="nt-sold-list">
            {inventory.map((p) => {
              const entry = productsSold[p.id];
              const isOn = !!entry;
              const lineTotal = isOn
                ? (Number(entry.quantity || 0) * Number(entry.unitPrice || 0))
                : 0;
              return (
                <div key={p.id} className={`nt-sold-item${isOn ? ' nt-sold-item--on' : ''}`}>
                  <label className="nt-sold-item__head">
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggleSoldProduct(p)}
                    />
                    <span className="nt-check__box" aria-hidden="true">{isOn && '✓'}</span>
                    <span className="nt-sold-item__name">{p.name}</span>
                    <span className="nt-sold-item__stock">{Number(p.stock || 0)} in stock</span>
                  </label>
                  {isOn && (
                    <div className="nt-sold-item__row">
                      <div className="nt-sold-field">
                        <label>Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={entry.quantity}
                          onChange={(e) => updateSoldLine(p.id, 'quantity', e.target.value)}
                        />
                      </div>
                      <div className="nt-sold-field">
                        <label>Unit $</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.unitPrice}
                          onChange={(e) => updateSoldLine(p.id, 'unitPrice', e.target.value)}
                        />
                      </div>
                      <div className="nt-sold-field nt-sold-field--total">
                        <label>Line Total</label>
                        <span className="nt-sold-line-total">{currency(lineTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {soldLinesPreview.length > 0 && (
          <>
            <div className="nt-sold-total">
              <span>Products Sold:</span>
              <strong>{currency(productSaleTotal)}</strong>
            </div>
            <div className="nt-subgroup">
              <label className="nt-subgroup__label">Payment Method</label>
              <div className="nt-radios">
                {PAYMENT_METHODS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`nt-radio${productSalePaymentMethod === opt.value ? ' nt-radio--on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={opt.value}
                      checked={productSalePaymentMethod === opt.value}
                      onChange={(e) => setProductSalePaymentMethod(e.target.value)}
                    />
                    <span className="nt-radio__dot" aria-hidden="true"></span>
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Skin Concerns */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Skin Concerns Noted</h3>
        <CheckboxGroup
          options={SKIN_CONCERNS}
          selected={skinConcerns}
          onToggle={(v) => toggle(skinConcerns, setSkinConcerns, v)}
        />
      </section>

      {/* Freeform Notes */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Session Notes</h3>
        <textarea
          className="nt-textarea"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Client mentioned increased dryness around chin. Used extra hydration in that area. Skin responded well to the peel — no irritation."
        />
      </section>

      {/* Recommendations */}
      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Recommendations</h3>

        <div className="nt-field">
          <label>Recommended Next Treatment</label>
          <select
            value={recommendedNextTreatment}
            onChange={(e) => setRecommendedNextTreatment(e.target.value)}
          >
            <option value="">— Select —</option>
            {NEXT_TREATMENTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="nt-subgroup">
          <label className="nt-subgroup__label">Recommended Products for Home Care</label>
          <CheckboxGroup
            options={PRODUCTS}
            selected={recommendedProducts}
            onToggle={(v) => toggle(recommendedProducts, setRecommendedProducts, v)}
          />
        </div>

        <div className="nt-subgroup">
          <label className="nt-subgroup__label">Next Appointment Timing</label>
          <div className="nt-radios">
            {TIMING_OPTIONS.map((opt) => (
              <label key={opt.value} className={`nt-radio${nextAppointmentTiming === opt.value ? ' nt-radio--on' : ''}`}>
                <input
                  type="radio"
                  name="timing"
                  value={opt.value}
                  checked={nextAppointmentTiming === opt.value}
                  onChange={(e) => setNextAppointmentTiming(e.target.value)}
                />
                <span className="nt-radio__dot" aria-hidden="true"></span>
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {nextAppointmentTiming === 'custom' && (
            <input
              type="text"
              className="nt-custom-input"
              value={nextAppointmentCustom}
              onChange={(e) => setNextAppointmentCustom(e.target.value)}
              placeholder="e.g., 3 weeks"
            />
          )}
        </div>
      </section>

      {error && <div className="nt-error">{error}</div>}

      <button
        type="button"
        className="nt-btn nt-btn--primary nt-btn--full nt-btn--save"
        onClick={handleSave}
      >
        {existing ? 'Save Changes' : 'Save Session Notes'}
      </button>

      {stockWarning && (
        <div className="nt-modal" onClick={() => setStockWarning(null)}>
          <div className="nt-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>Low Stock Warning</h3>
            <p>{stockWarning.message}</p>
            <div className="nt-modal__actions">
              <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setStockWarning(null)}>Cancel</button>
              <button type="button" className="nt-btn nt-btn--primary" onClick={stockWarning.onConfirm}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Session Detail View ─────────────────────────────────────────────────────

function SessionDetail({ session, onBack, onEdit, onDelete }) {
  const [previewImg, setPreviewImg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const timing = TIMING_OPTIONS.find((o) => o.value === session.nextAppointmentTiming);
  const timingLabel =
    session.nextAppointmentTiming === 'custom'
      ? `Custom: ${session.nextAppointmentCustom}`
      : timing?.label || '—';

  return (
    <div className="nt-detail">
      {previewImg && (
        <div className="nt-lightbox" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="Preview" />
          <button type="button" className="nt-lightbox__close" aria-label="Close preview">×</button>
        </div>
      )}

      <div className="nt-detail__head">
        <button type="button" className="nt-btn nt-btn--ghost nt-btn--sm" onClick={onBack}>← Back</button>
      </div>

      <div className="nt-detail__title">
        <h2>{session.clientName}</h2>
        <p className="nt-detail__date">{formatDate(session.date)} · saved {formatTime(session.createdAt)}</p>
        {session.clientEmail && <p className="nt-detail__contact">{session.clientEmail}</p>}
        {session.clientPhone && <p className="nt-detail__contact">{session.clientPhone}</p>}
      </div>

      {/* Photos */}
      {(['before', 'after', 'treatment']).map((group) => {
        const photos = session.photos?.[group] || [];
        if (photos.length === 0) return null;
        const label = group === 'before' ? 'Before' : group === 'after' ? 'After' : 'Treatment Area';
        return (
          <section key={group} className="nt-detail__section">
            <h3 className="nt-detail__section-title">{label} Photos</h3>
            <div className="nt-photo-grid">
              {photos.map((p, i) => (
                <button
                  type="button"
                  key={i}
                  className="nt-photo-grid__item"
                  onClick={() => setPreviewImg(p.data)}
                >
                  <img src={p.data} alt={`${label} ${i + 1}`} />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {session.treatmentsPerformed?.length > 0 && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Treatment Performed</h3>
          <div className="nt-pills">
            {session.treatmentsPerformed.map((t) => (
              <span key={t} className="nt-pill nt-pill--sage">{t}</span>
            ))}
          </div>
        </section>
      )}

      {session.productsUsed?.length > 0 && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Products Used</h3>
          <div className="nt-pills">
            {session.productsUsed.map((p) => (
              <span key={p} className="nt-pill">{p}</span>
            ))}
          </div>
        </section>
      )}

      {session.skinConcerns?.length > 0 && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Skin Concerns Noted</h3>
          <div className="nt-pills">
            {session.skinConcerns.map((c) => (
              <span key={c} className="nt-pill nt-pill--terra">{c}</span>
            ))}
          </div>
        </section>
      )}

      {session.productsSold?.length > 0 && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Products Sold</h3>
          <div className="nt-sold-summary">
            {session.productsSold.map((line, i) => (
              <div key={i} className="nt-sold-summary__row">
                <span className="nt-sold-summary__name">{line.name}</span>
                <span className="nt-sold-summary__qty">× {line.quantity}</span>
                <span className="nt-sold-summary__total">{currency(line.lineTotal)}</span>
              </div>
            ))}
            <div className="nt-sold-summary__footer">
              <span>Total</span>
              <strong>{currency(session.productSaleTotal)}</strong>
            </div>
            {session.productSalePaymentMethod && (
              <div className="nt-sold-summary__payment">
                Paid via: {PAYMENT_METHODS.find((p) => p.value === session.productSalePaymentMethod)?.label || session.productSalePaymentMethod}
              </div>
            )}
          </div>
        </section>
      )}

      {session.notes && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Notes</h3>
          <p className="nt-detail__notes">{session.notes}</p>
        </section>
      )}

      <section className="nt-detail__section nt-recommend">
        <h3 className="nt-detail__section-title">Recommendations</h3>
        <div className="nt-recommend__item">
          <strong>Next Treatment:</strong> {session.recommendedNextTreatment || '—'}
        </div>
        <div className="nt-recommend__item">
          <strong>Home Care Products:</strong>{' '}
          {session.recommendedProducts?.length > 0
            ? session.recommendedProducts.join(', ')
            : '—'}
        </div>
        <div className="nt-recommend__item">
          <strong>Next Appointment:</strong> {timingLabel}
        </div>
      </section>

      <div className="nt-detail__actions">
        <button type="button" className="nt-btn nt-btn--secondary" onClick={() => onEdit(session)}>Edit</button>
        <button type="button" className="nt-btn nt-btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
      </div>

      {confirmDelete && (
        <div className="nt-modal" onClick={() => setConfirmDelete(false)}>
          <div className="nt-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete this session?</h3>
            <p>This can't be undone.</p>
            <div className="nt-modal__actions">
              <button type="button" className="nt-btn nt-btn--ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="nt-btn nt-btn--danger" onClick={() => { onDelete(session.id); setConfirmDelete(false); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Session Card (list item) ────────────────────────────────────────────────

function SessionCard({ session, onClick }) {
  const treatments = (session.treatmentsPerformed || []).join(', ');
  return (
    <button type="button" className="nt-card" onClick={onClick}>
      <div className="nt-card__top">
        <h4 className="nt-card__name">{session.clientName || 'Unknown client'}</h4>
        <span className="nt-card__date">{formatDate(session.date)}</span>
      </div>
      {treatments && <p className="nt-card__svc">{treatments}</p>}
      <p className="nt-card__time">Saved {formatTime(session.createdAt)}</p>
    </button>
  );
}

// ─── Client Card ─────────────────────────────────────────────────────────────

function ClientCard({ client, onClick }) {
  return (
    <button type="button" className="nt-card nt-card--client" onClick={onClick}>
      <div className="nt-card__top">
        <h4 className="nt-card__name">{client.name || '(no name)'}</h4>
        <span className="nt-card__badge">{client.totalVisits} visit{client.totalVisits === 1 ? '' : 's'}</span>
      </div>
      {client.email && <p className="nt-card__svc">{client.email}</p>}
      {client.lastVisit && <p className="nt-card__time">Last visit: {formatDate(client.lastVisit)}</p>}
    </button>
  );
}

// ─── Client Profile View ─────────────────────────────────────────────────────

function ClientProfile({ client, onBack, onOpenSession }) {
  const sessions = useMemo(() => getSessionsByClientKey(client.key), [client.key]);

  return (
    <div className="nt-client-profile">
      <div className="nt-detail__head">
        <button type="button" className="nt-btn nt-btn--ghost nt-btn--sm" onClick={onBack}>← Back</button>
      </div>
      <div className="nt-detail__title">
        <h2>{client.name}</h2>
        {client.email && <p className="nt-detail__contact">{client.email}</p>}
        {client.phone && <p className="nt-detail__contact">{client.phone}</p>}
        <p className="nt-detail__date">
          {client.totalVisits} visit{client.totalVisits === 1 ? '' : 's'}
          {client.lastVisit && ` · last visit ${formatDate(client.lastVisit)}`}
        </p>
      </div>

      {client.ongoingConcerns?.length > 0 && (
        <section className="nt-detail__section">
          <h3 className="nt-detail__section-title">Ongoing Concerns</h3>
          <div className="nt-pills">
            {client.ongoingConcerns.map((c) => (
              <span key={c} className="nt-pill nt-pill--terra">{c}</span>
            ))}
          </div>
        </section>
      )}

      <section className="nt-detail__section">
        <h3 className="nt-detail__section-title">Session History</h3>
        <div className="nt-card-list">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onClick={() => onOpenSession(s.id)} />
          ))}
          {sessions.length === 0 && <p className="nt-empty">No sessions yet.</p>}
        </div>
      </section>
    </div>
  );
}

// ─── Inventory Panel ─────────────────────────────────────────────────────────

function InventoryPanel({ refreshKey, onChanged }) {
  const [sortBy, setSortBy] = useState('name'); // name | stock | margin
  const [view, setView] = useState('list'); // list | add | edit
  const [editingProduct, setEditingProduct] = useState(null);

  const inventory = useMemo(
    () => (typeof window !== 'undefined' ? getInventory() : []),
    [refreshKey]
  );

  const monthRange = useMemo(() => thisMonthRange(), []);
  const stats = useMemo(() => {
    const products = inventory;
    const totalRetail = products.reduce(
      (s, p) => s + Number(p.retailPrice || 0) * Number(p.stock || 0),
      0
    );
    const totalCost = products.reduce(
      (s, p) => s + Number(p.costPrice || 0) * Number(p.stock || 0),
      0
    );
    const lowStock = products.filter(
      (p) => Number(p.stock || 0) <= Number(p.threshold || 0) && Number(p.stock || 0) > 0
    ).length;
    const outOfStock = products.filter((p) => Number(p.stock || 0) === 0).length;
    const report = getProductSalesReport(monthRange.start, monthRange.end);
    return {
      count: products.length,
      totalRetail,
      totalCost,
      lowStock,
      outOfStock,
      monthSales: report.total,
    };
  }, [inventory, monthRange, refreshKey]);

  const sorted = useMemo(() => {
    const copy = [...inventory];
    if (sortBy === 'name') {
      copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'stock') {
      copy.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    } else if (sortBy === 'margin') {
      const margin = (p) => {
        const r = Number(p.retailPrice || 0);
        const c = Number(p.costPrice || 0);
        if (r === 0) return -1;
        return (r - c) / r;
      };
      copy.sort((a, b) => margin(b) - margin(a));
    }
    return copy;
  }, [inventory, sortBy]);

  function handleSaved() {
    setView('list');
    setEditingProduct(null);
    onChanged();
  }

  function handleDelete(productId) {
    if (typeof window !== 'undefined' && confirm('Delete this product? This will not affect past session records.')) {
      deleteProduct(productId);
      setView('list');
      setEditingProduct(null);
      onChanged();
    }
  }

  if (view === 'add' || view === 'edit') {
    return (
      <ProductForm
        existing={editingProduct}
        onSaved={handleSaved}
        onCancel={() => { setView('list'); setEditingProduct(null); }}
        onDelete={view === 'edit' ? handleDelete : null}
      />
    );
  }

  return (
    <section className="nt-tab-panel">
      <div className="nt-tab-head">
        <div>
          <h2 className="nt-tab-title">Inventory</h2>
        </div>
        <button
          type="button"
          className="nt-btn nt-btn--primary"
          onClick={() => { setEditingProduct(null); setView('add'); }}
        >+ Add Product</button>
      </div>

      {/* Dashboard stats */}
      <div className="nt-inv-dash">
        <div className="nt-inv-stat">
          <span className="nt-inv-stat__label">Products</span>
          <span className="nt-inv-stat__value">{stats.count}</span>
        </div>
        <div className="nt-inv-stat">
          <span className="nt-inv-stat__label">Retail Value</span>
          <span className="nt-inv-stat__value">{currency(stats.totalRetail)}</span>
        </div>
        <div className="nt-inv-stat">
          <span className="nt-inv-stat__label">Cost Value</span>
          <span className="nt-inv-stat__value nt-inv-stat__value--sm">{currency(stats.totalCost)}</span>
        </div>
        <div className="nt-inv-stat">
          <span className="nt-inv-stat__label">Low Stock</span>
          <span className={`nt-inv-stat__value${stats.lowStock > 0 ? ' nt-inv-stat__value--warn' : ''}`}>
            {stats.lowStock}
          </span>
        </div>
        <div className="nt-inv-stat">
          <span className="nt-inv-stat__label">Out of Stock</span>
          <span className={`nt-inv-stat__value${stats.outOfStock > 0 ? ' nt-inv-stat__value--danger' : ''}`}>
            {stats.outOfStock}
          </span>
        </div>
        <div className="nt-inv-stat nt-inv-stat--wide">
          <span className="nt-inv-stat__label">This Month's Product Sales</span>
          <span className="nt-inv-stat__value nt-inv-stat__value--accent">
            {currency(stats.monthSales)}
          </span>
        </div>
      </div>

      {/* Sort */}
      <div className="nt-inv-sort">
        <span>Sort:</span>
        <button
          type="button"
          className={`nt-chip${sortBy === 'name' ? ' nt-chip--on' : ''}`}
          onClick={() => setSortBy('name')}
        >A–Z</button>
        <button
          type="button"
          className={`nt-chip${sortBy === 'stock' ? ' nt-chip--on' : ''}`}
          onClick={() => setSortBy('stock')}
        >Lowest Stock</button>
        <button
          type="button"
          className={`nt-chip${sortBy === 'margin' ? ' nt-chip--on' : ''}`}
          onClick={() => setSortBy('margin')}
        >Highest Margin</button>
      </div>

      {/* List */}
      <div className="nt-card-list">
        {sorted.map((p) => {
          const stock = Number(p.stock || 0);
          const threshold = Number(p.threshold || 0);
          const retail = Number(p.retailPrice || 0);
          const cost = Number(p.costPrice || 0);
          const margin = retail > 0 ? Math.round(((retail - cost) / retail) * 100) : 0;
          const isOut = stock === 0;
          const isLow = !isOut && stock <= threshold;
          return (
            <button
              type="button"
              key={p.id}
              className={`nt-prod-card${isLow ? ' nt-prod-card--low' : ''}${isOut ? ' nt-prod-card--out' : ''}`}
              onClick={() => { setEditingProduct(p); setView('edit'); }}
            >
              <div className="nt-prod-card__top">
                <div className="nt-prod-card__info">
                  <h4 className="nt-prod-card__name">{p.name}</h4>
                  <p className="nt-prod-card__meta">
                    {p.brand}{p.category ? ` · ${p.category}` : ''}
                  </p>
                </div>
                <div className="nt-prod-card__stock">
                  <span className="nt-prod-card__stock-num">{stock}</span>
                  <span className="nt-prod-card__stock-label">in stock</span>
                </div>
              </div>
              <div className="nt-prod-card__bottom">
                <div className="nt-prod-card__price">
                  <span className="nt-prod-card__retail">{currency(retail)}</span>
                  <span className="nt-prod-card__cost">cost {currency(cost)}</span>
                </div>
                <span className="nt-prod-card__margin">{margin}% margin</span>
                {isOut && <span className="nt-badge nt-badge--danger">OUT OF STOCK</span>}
                {isLow && <span className="nt-badge nt-badge--warn">Low Stock</span>}
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="nt-empty">No products yet. Tap "+ Add Product" to get started.</p>
        )}
      </div>
    </section>
  );
}

// ─── Product Form ────────────────────────────────────────────────────────────

function ProductForm({ existing, onSaved, onCancel, onDelete }) {
  const [name, setName] = useState(existing?.name || '');
  const [brand, setBrand] = useState(existing?.brand || 'Dermalogica');
  const [category, setCategory] = useState(existing?.category || PRODUCT_CATEGORIES[0]);
  const [retailPrice, setRetailPrice] = useState(existing?.retailPrice ?? '');
  const [costPrice, setCostPrice] = useState(existing?.costPrice ?? '');
  const [stock, setStock] = useState(existing?.stock ?? '');
  const [threshold, setThreshold] = useState(existing?.threshold ?? 3);
  const [productNotes, setProductNotes] = useState(existing?.notes || '');
  const [error, setError] = useState('');

  function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Please enter a product name.');
      return;
    }
    const payload = {
      name: name.trim(),
      brand: brand.trim(),
      category,
      retailPrice: Number(retailPrice) || 0,
      costPrice: Number(costPrice) || 0,
      stock: Number(stock) || 0,
      threshold: Number(threshold) || 0,
      notes: productNotes.trim(),
    };
    if (existing) {
      updateProduct(existing.id, payload);
    } else {
      addProduct(payload);
    }
    onSaved();
  }

  return (
    <div className="nt-form">
      <div className="nt-form__head">
        <h2>{existing ? 'Edit Product' : 'Add Product'}</h2>
        <button type="button" className="nt-btn nt-btn--ghost nt-btn--sm" onClick={onCancel}>Cancel</button>
      </div>

      <section className="nt-form__section">
        <div className="nt-field">
          <label>Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., BioLumin-C Serum"
          />
        </div>
        <div className="nt-field">
          <label>Brand</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Dermalogica"
          />
        </div>
        <div className="nt-field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Pricing</h3>
        <div className="nt-field">
          <label>Retail Price ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="nt-field">
          <label>Cost Price ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </section>

      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Stock</h3>
        <div className="nt-field">
          <label>Current Stock</label>
          <input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="nt-field">
          <label>Low Stock Alert Threshold</label>
          <input
            type="number"
            min="0"
            step="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="3"
          />
        </div>
      </section>

      <section className="nt-form__section">
        <h3 className="nt-form__section-title">Notes</h3>
        <textarea
          className="nt-textarea"
          rows={3}
          value={productNotes}
          onChange={(e) => setProductNotes(e.target.value)}
          placeholder="Maria's favorites, best for dry skin clients, etc."
        />
      </section>

      {error && <div className="nt-error">{error}</div>}

      <button
        type="button"
        className="nt-btn nt-btn--primary nt-btn--full nt-btn--save"
        onClick={handleSave}
      >
        {existing ? 'Save Changes' : 'Add Product'}
      </button>

      {existing && onDelete && (
        <button
          type="button"
          className="nt-btn nt-btn--danger nt-btn--full"
          style={{ marginTop: 12 }}
          onClick={() => onDelete(existing.id)}
        >Delete Product</button>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function ClientNotes() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('today'); // today | clients | all | inventory
  const [view, setView] = useState('list'); // list | new | detail | edit | client
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeClient, setActiveClient] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  // Auth
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1') {
      setAuthed(true);
    }
  }, []);

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
  }

  const todaySessions = useMemo(
    () => (authed ? getTodaySessions() : []),
    [authed, refreshKey]
  );
  const allSessions = useMemo(
    () => (authed ? getAllSessions() : []),
    [authed, refreshKey]
  );
  const clients = useMemo(
    () => (authed ? searchClients(searchQuery) : []),
    [authed, searchQuery, refreshKey]
  );

  const filteredAll = useMemo(() => {
    return allSessions.filter((s) => {
      if (fromDate && s.date < fromDate) return false;
      if (toDate && s.date > toDate) return false;
      return true;
    });
  }, [allSessions, fromDate, toDate]);

  const activeSession = activeSessionId ? getSession(activeSessionId) : null;

  function handleSaved(session) {
    setRefreshKey((k) => k + 1);
    setView('list');
    setActiveSessionId(null);
    setTab('today');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Brief success toast
    setToast(`Session saved for ${session.clientName}! ✓`);
    setTimeout(() => setToast(''), 3500);
  }

  const [toast, setToast] = useState('');

  function handleDelete(id) {
    deleteSession(id);
    setRefreshKey((k) => k + 1);
    setActiveSessionId(null);
    setView('list');
  }

  function openSession(id) {
    setActiveSessionId(id);
    setView('detail');
  }

  function openClient(client) {
    setActiveClient(client);
    setView('client');
  }

  function downloadBackup() {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fresh-face-notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  }

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  return (
    <div className="nt-app">
      {/* Header */}
      <header className="nt-header">
        <div className="nt-header__inner">
          <h1 className="nt-header__title">Fresh Face Notes</h1>
          <button
            type="button"
            className="nt-header__menu"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
          >⋮</button>
          {showMenu && (
            <div className="nt-menu" onMouseLeave={() => setShowMenu(false)}>
              <button type="button" onClick={downloadBackup}>Export All Data</button>
              <button type="button" onClick={logout}>Log Out</button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="nt-body">
        {toast && <div className="nt-toast">{toast}</div>}

        {view === 'new' && (
          <SessionForm onSaved={handleSaved} onCancel={() => setView('list')} />
        )}

        {view === 'edit' && activeSession && (
          <SessionForm existing={activeSession} onSaved={handleSaved} onCancel={() => setView('detail')} />
        )}

        {view === 'detail' && activeSession && (
          <SessionDetail
            session={activeSession}
            onBack={() => { setView('list'); setActiveSessionId(null); }}
            onEdit={(s) => { setActiveSessionId(s.id); setView('edit'); }}
            onDelete={handleDelete}
          />
        )}

        {view === 'client' && activeClient && (
          <ClientProfile
            client={activeClient}
            onBack={() => { setActiveClient(null); setView('list'); }}
            onOpenSession={openSession}
          />
        )}

        {view === 'list' && (
          <>
            {tab === 'today' && (
              <section className="nt-tab-panel">
                <div className="nt-tab-head">
                  <div>
                    <h2 className="nt-tab-title">Today's Sessions</h2>
                    <p className="nt-tab-date">{todayFriendly()}</p>
                  </div>
                  <button
                    type="button"
                    className="nt-btn nt-btn--primary"
                    onClick={() => setView('new')}
                  >+ New Session</button>
                </div>
                <div className="nt-card-list">
                  {todaySessions.map((s) => (
                    <SessionCard key={s.id} session={s} onClick={() => openSession(s.id)} />
                  ))}
                  {todaySessions.length === 0 && (
                    <p className="nt-empty">No sessions yet today. Tap "New Session" above to start.</p>
                  )}
                </div>
              </section>
            )}

            {tab === 'clients' && (
              <section className="nt-tab-panel">
                <div className="nt-tab-head">
                  <h2 className="nt-tab-title">Client Lookup</h2>
                </div>
                <input
                  type="search"
                  className="nt-search"
                  placeholder="Search by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="nt-card-list">
                  {clients.map((c) => (
                    <ClientCard key={c.key} client={c} onClick={() => openClient(c)} />
                  ))}
                  {clients.length === 0 && (
                    <p className="nt-empty">
                      {searchQuery ? 'No clients match that search.' : 'No clients yet.'}
                    </p>
                  )}
                </div>
              </section>
            )}

            {tab === 'inventory' && (
              <InventoryPanel refreshKey={refreshKey} onChanged={() => setRefreshKey((k) => k + 1)} />
            )}

            {tab === 'all' && (
              <section className="nt-tab-panel">
                <div className="nt-tab-head">
                  <h2 className="nt-tab-title">All Sessions</h2>
                </div>
                <div className="nt-filter-row">
                  <label>
                    <span>From</span>
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </label>
                  <label>
                    <span>To</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </label>
                  {(fromDate || toDate) && (
                    <button
                      type="button"
                      className="nt-btn nt-btn--ghost nt-btn--sm"
                      onClick={() => { setFromDate(''); setToDate(''); }}
                    >Clear</button>
                  )}
                </div>
                <div className="nt-card-list">
                  {filteredAll.map((s) => (
                    <SessionCard key={s.id} session={s} onClick={() => openSession(s.id)} />
                  ))}
                  {filteredAll.length === 0 && <p className="nt-empty">No sessions found.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Bottom tab bar — only when in list view */}
      {view === 'list' && (
        <nav className="nt-tabbar" aria-label="Main tabs">
          <button
            type="button"
            className={`nt-tabbar__btn${tab === 'today' ? ' nt-tabbar__btn--active' : ''}`}
            onClick={() => setTab('today')}
          >
            <span className="nt-tabbar__icon" aria-hidden="true">●</span>
            <span className="nt-tabbar__label">
              Today
              {todaySessions.length > 0 && <span className="nt-tabbar__badge">{todaySessions.length}</span>}
            </span>
          </button>
          <button
            type="button"
            className={`nt-tabbar__btn${tab === 'clients' ? ' nt-tabbar__btn--active' : ''}`}
            onClick={() => setTab('clients')}
          >
            <span className="nt-tabbar__icon" aria-hidden="true">◉</span>
            <span className="nt-tabbar__label">Clients</span>
          </button>
          <button
            type="button"
            className={`nt-tabbar__btn${tab === 'all' ? ' nt-tabbar__btn--active' : ''}`}
            onClick={() => setTab('all')}
          >
            <span className="nt-tabbar__icon" aria-hidden="true">≡</span>
            <span className="nt-tabbar__label">All</span>
          </button>
          <button
            type="button"
            className={`nt-tabbar__btn${tab === 'inventory' ? ' nt-tabbar__btn--active' : ''}`}
            onClick={() => setTab('inventory')}
          >
            <span className="nt-tabbar__icon" aria-hidden="true">▣</span>
            <span className="nt-tabbar__label">Inventory</span>
          </button>
        </nav>
      )}

      <style>{STYLES}</style>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const STYLES = `
  .nt-app {
    min-height: 100vh;
    background: #F7F3EE;
    color: #2D2926;
    font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    padding-bottom: 88px;
    -webkit-font-smoothing: antialiased;
  }

  /* ==== Password Gate ==== */
  .nt-gate {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: linear-gradient(135deg, #F7F3EE 0%, #E8EDDF 100%);
  }
  .nt-gate__card {
    background: #fff;
    padding: 40px 32px;
    border-radius: 16px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(44, 40, 37, 0.08);
    text-align: center;
  }
  .nt-gate__logo {
    font-family: 'Lora', Georgia, serif;
    font-size: 24px;
    font-weight: 600;
    color: #2D2926;
    margin-bottom: 8px;
  }
  .nt-gate__subtitle {
    font-size: 14px;
    color: #7A7471;
    margin-bottom: 24px;
  }
  .nt-gate__form { display: flex; flex-direction: column; gap: 12px; }
  .nt-gate__input {
    width: 100%;
    padding: 14px 16px;
    font-size: 16px;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .nt-gate__input:focus { border-color: #8B9E87; }
  .nt-gate__input--error { border-color: #C24141; }
  .nt-gate__error { color: #C24141; font-size: 14px; margin-top: 12px; }

  /* ==== Header ==== */
  .nt-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #2D2926;
    color: #fff;
  }
  .nt-header__inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
  }
  .nt-header__title {
    font-family: 'Lora', Georgia, serif;
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }
  .nt-header__menu {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 12px;
    border-radius: 6px;
  }
  .nt-header__menu:hover { background: rgba(255,255,255,0.08); }
  .nt-menu {
    position: absolute;
    top: 100%;
    right: 20px;
    background: #fff;
    color: #2D2926;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    overflow: hidden;
    min-width: 180px;
    margin-top: 4px;
  }
  .nt-menu button {
    display: block;
    width: 100%;
    padding: 12px 16px;
    text-align: left;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 14px;
    cursor: pointer;
    color: #2D2926;
  }
  .nt-menu button:hover { background: #F7F3EE; }

  /* ==== Body ==== */
  .nt-body {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px;
  }

  /* ==== Toast ==== */
  .nt-toast {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #6B7F67;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    z-index: 60;
    animation: nt-toast-in 0.3s ease;
  }
  @keyframes nt-toast-in {
    from { transform: translate(-50%, -10px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }

  /* ==== Tab head / titles ==== */
  .nt-tab-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }
  .nt-tab-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
  .nt-tab-date {
    font-size: 13px;
    color: #7A7471;
    margin-top: 2px;
  }

  /* ==== Search + filter ==== */
  .nt-search {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid #DDD6CD;
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    margin-bottom: 16px;
    outline: none;
    background: #fff;
  }
  .nt-search:focus { border-color: #8B9E87; }

  .nt-filter-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .nt-filter-row label {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 130px;
    font-size: 12px;
    color: #7A7471;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    gap: 4px;
  }
  .nt-filter-row input {
    padding: 10px 12px;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    background: #fff;
  }

  /* ==== Cards ==== */
  .nt-card-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .nt-card {
    display: block;
    width: 100%;
    text-align: left;
    background: #fff;
    border: 1px solid #EDE7DF;
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  }
  .nt-card:hover { border-color: #8B9E87; box-shadow: 0 4px 16px rgba(44,40,37,0.06); }
  .nt-card:active { transform: scale(0.99); }
  .nt-card__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 6px;
  }
  .nt-card__name {
    font-family: 'Lora', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    margin: 0;
    color: #2D2926;
  }
  .nt-card__date {
    font-size: 12px;
    color: #7A7471;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .nt-card__svc {
    font-size: 14px;
    color: #2D2926;
    margin: 4px 0 0;
  }
  .nt-card__time {
    font-size: 12px;
    color: #A69E9A;
    margin-top: 6px;
  }
  .nt-card__badge {
    background: #E8EDDF;
    color: #6B7F67;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  }

  .nt-empty {
    color: #A69E9A;
    font-size: 14px;
    padding: 32px 12px;
    text-align: center;
    font-style: italic;
  }

  /* ==== Buttons ==== */
  .nt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    line-height: 1;
  }
  .nt-btn--primary { background: #B8907A; color: #fff; border-color: #B8907A; }
  .nt-btn--primary:hover { background: #9E7A65; border-color: #9E7A65; }
  .nt-btn--secondary { background: #fff; color: #2D2926; border-color: #2D2926; }
  .nt-btn--secondary:hover { background: #2D2926; color: #fff; }
  .nt-btn--danger { background: #fff; color: #C24141; border-color: #C24141; }
  .nt-btn--danger:hover { background: #C24141; color: #fff; }
  .nt-btn--ghost { background: transparent; color: #7A7471; border-color: transparent; text-transform: none; letter-spacing: 0; font-weight: 600; }
  .nt-btn--ghost:hover { color: #2D2926; background: #EDE7DF; }
  .nt-btn--full { width: 100%; }
  .nt-btn--sm { padding: 8px 14px; font-size: 12px; }
  .nt-btn--save { padding: 18px 20px; font-size: 15px; margin-top: 24px; }

  /* ==== Form ==== */
  .nt-form { background: transparent; }
  .nt-form__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .nt-form__head h2 {
    font-family: 'Lora', Georgia, serif;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
  .nt-form__section {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    border: 1px solid #EDE7DF;
  }
  .nt-form__section-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 14px 0;
    color: #2D2926;
  }

  .nt-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    position: relative;
  }
  .nt-field:last-child { margin-bottom: 0; }
  .nt-field label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
  }
  .nt-field input,
  .nt-field select {
    padding: 12px 14px;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-size: 16px;
    font-family: inherit;
    background: #fff;
    outline: none;
    transition: border-color 0.15s;
  }
  .nt-field input:focus,
  .nt-field select:focus { border-color: #8B9E87; }
  .nt-field--other { margin-top: 14px; padding-top: 14px; border-top: 1px dashed #EDE7DF; }

  .nt-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    z-index: 10;
    list-style: none;
    padding: 4px;
    margin: 4px 0 0;
    max-height: 220px;
    overflow-y: auto;
  }
  .nt-suggestions li { padding: 0; }
  .nt-suggestions button {
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 14px;
    cursor: pointer;
    border-radius: 6px;
    color: #2D2926;
  }
  .nt-suggestions button:hover { background: #F7F3EE; }
  .nt-suggestions em { color: #A69E9A; font-style: normal; font-size: 12px; }

  .nt-textarea {
    width: 100%;
    padding: 14px;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    background: #fff;
    line-height: 1.6;
    outline: none;
    resize: vertical;
    min-height: 120px;
  }
  .nt-textarea:focus { border-color: #8B9E87; }

  /* ==== Checkboxes ==== */
  .nt-checks {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .nt-check {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #F7F3EE;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 14px;
    line-height: 1.4;
    user-select: none;
  }
  .nt-check input { position: absolute; opacity: 0; width: 0; height: 0; }
  .nt-check__box {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border: 2px solid #DDD6CD;
    border-radius: 5px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: transparent;
    transition: all 0.15s;
    font-weight: 700;
  }
  .nt-check--on {
    background: #E8EDDF;
    border-color: #8B9E87;
  }
  .nt-check--on .nt-check__box {
    background: #6B7F67;
    border-color: #6B7F67;
    color: #fff;
  }
  .nt-check__label { flex: 1; color: #2D2926; }

  /* ==== Radios ==== */
  .nt-radios { display: flex; flex-direction: column; gap: 8px; }
  .nt-radio {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #F7F3EE;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    user-select: none;
    transition: all 0.15s;
  }
  .nt-radio input { position: absolute; opacity: 0; width: 0; height: 0; }
  .nt-radio__dot {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border: 2px solid #DDD6CD;
    border-radius: 50%;
    background: #fff;
    position: relative;
    transition: all 0.15s;
  }
  .nt-radio--on {
    background: #E8EDDF;
    border-color: #8B9E87;
  }
  .nt-radio--on .nt-radio__dot {
    border-color: #6B7F67;
  }
  .nt-radio--on .nt-radio__dot::after {
    content: '';
    position: absolute;
    inset: 4px;
    background: #6B7F67;
    border-radius: 50%;
  }
  .nt-custom-input {
    margin-top: 10px;
    padding: 12px 14px;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    width: 100%;
    background: #fff;
  }

  .nt-subgroup { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #EDE7DF; }
  .nt-subgroup__label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
    margin-bottom: 10px;
  }

  /* ==== Photos ==== */
  .nt-photos { margin-bottom: 16px; }
  .nt-photos:last-child { margin-bottom: 0; }
  .nt-photos__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .nt-photos__label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
  }
  .nt-photos__actions { display: flex; gap: 8px; }
  .nt-photo-btn {
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #DDD6CD;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    color: #2D2926;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .nt-photo-btn:hover { border-color: #8B9E87; }

  .nt-photos__strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0;
    -webkit-overflow-scrolling: touch;
  }
  .nt-thumb {
    position: relative;
    flex-shrink: 0;
    width: 80px;
    height: 80px;
    border-radius: 8px;
    overflow: hidden;
    background: #EDE7DF;
    cursor: pointer;
  }
  .nt-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .nt-thumb__remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0,0,0,0.75);
    color: #fff;
    border: none;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ==== Error ==== */
  .nt-error {
    background: #FCE8E8;
    border: 1px solid #E3A5A5;
    color: #8F2424;
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 14px;
    margin: 12px 0;
  }

  /* ==== Detail view ==== */
  .nt-detail, .nt-client-profile { background: transparent; }
  .nt-detail__head { margin-bottom: 12px; }
  .nt-detail__title {
    background: #fff;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid #EDE7DF;
  }
  .nt-detail__title h2 {
    font-family: 'Lora', Georgia, serif;
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .nt-detail__date { font-size: 13px; color: #7A7471; margin: 0; }
  .nt-detail__contact { font-size: 13px; color: #7A7471; margin: 4px 0 0; }
  .nt-detail__section {
    background: #fff;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid #EDE7DF;
  }
  .nt-detail__section-title {
    font-family: 'Lora', Georgia, serif;
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 12px;
    color: #2D2926;
  }
  .nt-detail__notes {
    font-size: 14px;
    line-height: 1.7;
    color: #2D2926;
    white-space: pre-wrap;
    margin: 0;
  }
  .nt-pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .nt-pill {
    padding: 6px 12px;
    background: #F7F3EE;
    border-radius: 14px;
    font-size: 12px;
    color: #2D2926;
    font-weight: 600;
  }
  .nt-pill--sage { background: #E8EDDF; color: #4D5F49; }
  .nt-pill--terra { background: #F0E4DC; color: #7B5642; }

  .nt-recommend { background: #FDFBF8; border: 1px solid #E8EDDF; }
  .nt-recommend__item { font-size: 14px; margin-bottom: 8px; line-height: 1.6; }
  .nt-recommend__item:last-child { margin-bottom: 0; }
  .nt-recommend__item strong { color: #6B7F67; font-weight: 700; }

  .nt-photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
  .nt-photo-grid__item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #EDE7DF;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .nt-photo-grid__item img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .nt-detail__actions {
    display: flex;
    gap: 10px;
    margin-top: 24px;
  }
  .nt-detail__actions .nt-btn { flex: 1; }

  /* ==== Lightbox ==== */
  .nt-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    cursor: pointer;
  }
  .nt-lightbox img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }
  .nt-lightbox__close {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    color: #fff;
    border: none;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  /* ==== Modal ==== */
  .nt-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .nt-modal__card {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25);
  }
  .nt-modal__card h3 {
    font-family: 'Lora', Georgia, serif;
    font-size: 18px;
    margin: 0 0 8px;
  }
  .nt-modal__card p { font-size: 14px; color: #7A7471; margin: 0 0 20px; }
  .nt-modal__actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* ==== Bottom tab bar ==== */
  .nt-tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #EDE7DF;
    display: flex;
    z-index: 50;
    padding-bottom: env(safe-area-inset-bottom);
    box-shadow: 0 -2px 12px rgba(0,0,0,0.04);
  }
  .nt-tabbar__btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    color: #A69E9A;
    cursor: pointer;
    transition: color 0.15s;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .nt-tabbar__btn--active { color: #B8907A; }
  .nt-tabbar__icon { font-size: 18px; line-height: 1; }
  .nt-tabbar__label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .nt-tabbar__badge {
    background: #B8907A;
    color: #fff;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
    min-width: 18px;
    text-align: center;
  }

  /* ==== Products Sold (in session form) ==== */
  .nt-sold-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nt-sold-item {
    background: #F7F3EE;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 12px 14px;
    transition: all 0.15s;
  }
  .nt-sold-item--on {
    background: #fff;
    border-color: #8B9E87;
  }
  .nt-sold-item__head {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;
    font-size: 14px;
    line-height: 1.4;
  }
  .nt-sold-item__head input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .nt-sold-item--on .nt-check__box {
    background: #6B7F67;
    border-color: #6B7F67;
    color: #fff;
  }
  .nt-sold-item__name {
    flex: 1;
    color: #2D2926;
    font-weight: 600;
  }
  .nt-sold-item__stock {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #A69E9A;
    white-space: nowrap;
  }
  .nt-sold-item__row {
    display: grid;
    grid-template-columns: 70px 100px 1fr;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #EDE7DF;
    align-items: flex-end;
  }
  .nt-sold-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nt-sold-field label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
  }
  .nt-sold-field input {
    padding: 8px 10px;
    border: 1px solid #DDD6CD;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    background: #fff;
    outline: none;
    width: 100%;
  }
  .nt-sold-field input:focus { border-color: #8B9E87; }
  .nt-sold-field--total { align-items: flex-end; }
  .nt-sold-line-total {
    font-family: 'Lora', Georgia, serif;
    font-size: 18px;
    font-weight: 600;
    color: #6B7F67;
  }
  .nt-sold-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    background: #E8EDDF;
    border-radius: 8px;
    margin-top: 16px;
    font-size: 14px;
  }
  .nt-sold-total strong {
    font-family: 'Lora', Georgia, serif;
    font-size: 20px;
    color: #4D5F49;
  }

  /* ==== Products Sold summary (in detail view) ==== */
  .nt-sold-summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nt-sold-summary__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
    padding: 6px 0;
    border-bottom: 1px solid #EDE7DF;
  }
  .nt-sold-summary__name { flex: 1; color: #2D2926; }
  .nt-sold-summary__qty { color: #7A7471; font-size: 13px; }
  .nt-sold-summary__total { font-weight: 700; color: #2D2926; }
  .nt-sold-summary__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 10px;
    font-size: 14px;
  }
  .nt-sold-summary__footer strong {
    font-family: 'Lora', Georgia, serif;
    font-size: 18px;
    color: #6B7F67;
  }
  .nt-sold-summary__payment {
    font-size: 13px;
    color: #7A7471;
    font-style: italic;
    margin-top: 4px;
  }

  /* ==== Inventory dashboard ==== */
  .nt-inv-dash {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .nt-inv-stat {
    background: #fff;
    border: 1px solid #EDE7DF;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nt-inv-stat--wide { grid-column: 1 / -1; }
  .nt-inv-stat__label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
  }
  .nt-inv-stat__value {
    font-family: 'Lora', Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    color: #2D2926;
  }
  .nt-inv-stat__value--sm { font-size: 18px; color: #7A7471; }
  .nt-inv-stat__value--warn { color: #C88538; }
  .nt-inv-stat__value--danger { color: #C24141; }
  .nt-inv-stat__value--accent { color: #6B7F67; }

  /* ==== Inventory sort chips ==== */
  .nt-inv-sort {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
    flex-wrap: wrap;
  }
  .nt-chip {
    background: #fff;
    border: 1px solid #DDD6CD;
    border-radius: 14px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    color: #2D2926;
    transition: all 0.15s;
    text-transform: none;
    letter-spacing: 0;
  }
  .nt-chip:hover { border-color: #8B9E87; }
  .nt-chip--on {
    background: #6B7F67;
    border-color: #6B7F67;
    color: #fff;
  }

  /* ==== Product cards ==== */
  .nt-prod-card {
    display: block;
    width: 100%;
    text-align: left;
    background: #fff;
    border: 1px solid #EDE7DF;
    border-radius: 12px;
    padding: 14px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .nt-prod-card:hover {
    border-color: #8B9E87;
    box-shadow: 0 4px 16px rgba(44,40,37,0.06);
  }
  .nt-prod-card:active { transform: scale(0.99); }
  .nt-prod-card--low {
    border-color: #E3B87A;
    border-width: 2px;
  }
  .nt-prod-card--out {
    border-color: #E3A5A5;
    border-width: 2px;
    background: #FEF7F7;
  }
  .nt-prod-card__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }
  .nt-prod-card__info { flex: 1; min-width: 0; }
  .nt-prod-card__name {
    font-family: 'Lora', Georgia, serif;
    font-size: 16px;
    font-weight: 600;
    color: #2D2926;
    margin: 0;
    line-height: 1.3;
  }
  .nt-prod-card__meta {
    font-size: 12px;
    color: #A69E9A;
    margin-top: 2px;
  }
  .nt-prod-card__stock {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    padding: 4px 14px;
    border-radius: 8px;
    background: #F7F3EE;
    min-width: 70px;
  }
  .nt-prod-card--low .nt-prod-card__stock { background: #FBEBD2; }
  .nt-prod-card--out .nt-prod-card__stock { background: #FCE8E8; }
  .nt-prod-card__stock-num {
    font-family: 'Lora', Georgia, serif;
    font-size: 26px;
    font-weight: 600;
    color: #2D2926;
    line-height: 1;
  }
  .nt-prod-card--low .nt-prod-card__stock-num { color: #C88538; }
  .nt-prod-card--out .nt-prod-card__stock-num { color: #C24141; }
  .nt-prod-card__stock-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #7A7471;
    margin-top: 2px;
  }
  .nt-prod-card__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .nt-prod-card__price {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nt-prod-card__retail {
    font-family: 'Lora', Georgia, serif;
    font-size: 18px;
    font-weight: 600;
    color: #2D2926;
  }
  .nt-prod-card__cost {
    font-size: 11px;
    color: #A69E9A;
  }
  .nt-prod-card__margin {
    font-size: 12px;
    font-weight: 600;
    color: #6B7F67;
  }
  .nt-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .nt-badge--warn { background: #FBEBD2; color: #8A5A1A; }
  .nt-badge--danger { background: #FCE8E8; color: #8F2424; }

  /* ==== Responsive tweaks ==== */
  @media (min-width: 600px) {
    .nt-checks { grid-template-columns: 1fr 1fr; }
    .nt-header__title { font-size: 22px; }
    .nt-inv-dash { grid-template-columns: repeat(3, 1fr); }
  }
`;
