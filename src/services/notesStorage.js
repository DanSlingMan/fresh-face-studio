// TODO: Replace localStorage with Vercel KV or Supabase for production.
// This abstraction layer makes the swap painless — every component calls
// these functions, never localStorage directly. When we switch backends,
// only this file changes.

const SESSIONS_KEY = 'ffs_notes_sessions_v1';
const CLIENTS_KEY = 'ffs_notes_clients_v1';
const INVENTORY_KEY = 'ffs_notes_inventory_v1';
const INVENTORY_SEEDED_KEY = 'ffs_notes_inventory_seeded_v1';

export const PRODUCT_CATEGORIES = [
  'Cleanser',
  'Exfoliant',
  'Serum',
  'Moisturizer',
  'SPF',
  'Mask',
  'Eye Care',
  'Treatment',
  'Body',
  'Other',
];

const DEFAULT_INVENTORY = [
  { name: 'PreCleanse', brand: 'Dermalogica', category: 'Cleanser', retailPrice: 49, costPrice: 25, stock: 5, threshold: 3 },
  { name: 'Special Cleansing Gel', brand: 'Dermalogica', category: 'Cleanser', retailPrice: 38, costPrice: 19, stock: 5, threshold: 3 },
  { name: 'Daily Microfoliant', brand: 'Dermalogica', category: 'Exfoliant', retailPrice: 63, costPrice: 32, stock: 5, threshold: 3 },
  { name: 'BioLumin-C Serum', brand: 'Dermalogica', category: 'Serum', retailPrice: 91, costPrice: 46, stock: 5, threshold: 3 },
  { name: 'Multivitamin Power Recovery Masque', brand: 'Dermalogica', category: 'Mask', retailPrice: 55, costPrice: 28, stock: 5, threshold: 3 },
  { name: 'Dynamic Skin Recovery SPF50', brand: 'Dermalogica', category: 'SPF', retailPrice: 72, costPrice: 36, stock: 5, threshold: 3 },
  { name: 'AGE Bright Clearing Serum', brand: 'Dermalogica', category: 'Serum', retailPrice: 76, costPrice: 38, stock: 5, threshold: 3 },
  { name: 'Phyto Nature Firming Serum', brand: 'Dermalogica', category: 'Serum', retailPrice: 110, costPrice: 55, stock: 5, threshold: 3 },
  { name: 'Intensive Moisture Balance', brand: 'Dermalogica', category: 'Moisturizer', retailPrice: 62, costPrice: 31, stock: 5, threshold: 3 },
  { name: 'Skin Smoothing Cream', brand: 'Dermalogica', category: 'Moisturizer', retailPrice: 56, costPrice: 28, stock: 5, threshold: 3 },
  { name: 'Calm Water Gel', brand: 'Dermalogica', category: 'Moisturizer', retailPrice: 49, costPrice: 25, stock: 5, threshold: 3 },
  { name: 'Barrier Repair', brand: 'Dermalogica', category: 'Moisturizer', retailPrice: 55, costPrice: 28, stock: 5, threshold: 3 },
  { name: 'Retinol Clearing Oil', brand: 'Dermalogica', category: 'Treatment', retailPrice: 76, costPrice: 38, stock: 5, threshold: 3 },
];

// ─── Internal helpers ────────────────────────────────────────────────────────

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readSessions() {
  if (typeof window === 'undefined') return {};
  return safeParse(localStorage.getItem(SESSIONS_KEY), {});
}

function writeSessions(sessions) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function readClients() {
  if (typeof window === 'undefined') return {};
  return safeParse(localStorage.getItem(CLIENTS_KEY), {});
}

function writeClients(clients) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

// Client key: prefer email (normalized), fallback to name (normalized)
function clientKey(name, email) {
  const normEmail = (email || '').trim().toLowerCase();
  if (normEmail) return `email:${normEmail}`;
  const normName = (name || '').trim().toLowerCase();
  return `name:${normName}`;
}

function generateId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isoDateOnly(iso) {
  return (iso || '').slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Rebuild the client index from the current sessions map.
// Keeps the index in sync without worrying about drift.
function rebuildClientIndex(sessionsMap) {
  const clients = {};
  const sessions = Object.values(sessionsMap).sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  for (const s of sessions) {
    const key = clientKey(s.clientName, s.clientEmail);
    if (!clients[key]) {
      clients[key] = {
        key,
        name: s.clientName || '',
        email: s.clientEmail || '',
        phone: s.clientPhone || '',
        sessions: [],
        totalVisits: 0,
        lastVisit: null,
        skinType: '',
        ongoingConcerns: [],
      };
    }
    const c = clients[key];
    c.sessions.push(s.id);
    c.totalVisits = c.sessions.length;
    const sessionDate = s.date || isoDateOnly(s.createdAt);
    if (!c.lastVisit || sessionDate > c.lastVisit) {
      c.lastVisit = sessionDate;
      // Latest known contact info + concerns carry forward
      if (s.clientPhone) c.phone = s.clientPhone;
      if (s.clientEmail) c.email = s.clientEmail;
      if (s.clientName) c.name = s.clientName;
      if (Array.isArray(s.skinConcerns) && s.skinConcerns.length) {
        c.ongoingConcerns = [...s.skinConcerns];
      }
    }
  }

  return clients;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function saveSession(sessionData) {
  const now = new Date().toISOString();
  const sessions = readSessions();
  const session = {
    id: sessionData.id || generateId(),
    clientName: sessionData.clientName || '',
    clientEmail: sessionData.clientEmail || '',
    clientPhone: sessionData.clientPhone || '',
    date: sessionData.date || isoDateOnly(now),
    createdAt: sessionData.createdAt || now,
    updatedAt: now,
    photos: sessionData.photos || { before: [], after: [], treatment: [] },
    treatmentsPerformed: sessionData.treatmentsPerformed || [],
    productsUsed: sessionData.productsUsed || [],
    skinConcerns: sessionData.skinConcerns || [],
    notes: sessionData.notes || '',
    recommendedNextTreatment: sessionData.recommendedNextTreatment || '',
    recommendedProducts: sessionData.recommendedProducts || [],
    nextAppointmentTiming: sessionData.nextAppointmentTiming || '',
    nextAppointmentCustom: sessionData.nextAppointmentCustom || '',
    productsSold: sessionData.productsSold || [],
    productSaleTotal: Number(sessionData.productSaleTotal || 0),
    productSalePaymentMethod: sessionData.productSalePaymentMethod || '',
  };
  sessions[session.id] = session;
  writeSessions(sessions);
  writeClients(rebuildClientIndex(sessions));
  return session;
}

export function updateSession(sessionId, updatedData) {
  const sessions = readSessions();
  const existing = sessions[sessionId];
  if (!existing) return null;
  const now = new Date().toISOString();
  const merged = {
    ...existing,
    ...updatedData,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  sessions[sessionId] = merged;
  writeSessions(sessions);
  writeClients(rebuildClientIndex(sessions));
  return merged;
}

export function deleteSession(sessionId) {
  const sessions = readSessions();
  if (!sessions[sessionId]) return false;
  delete sessions[sessionId];
  writeSessions(sessions);
  writeClients(rebuildClientIndex(sessions));
  return true;
}

export function getSession(sessionId) {
  const sessions = readSessions();
  return sessions[sessionId] || null;
}

export function getAllSessions(limit = 1000, offset = 0) {
  const all = Object.values(readSessions()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  return all.slice(offset, offset + limit);
}

export function getTodaySessions() {
  const today = todayIso();
  return getAllSessions().filter((s) => (s.date || isoDateOnly(s.createdAt)) === today);
}

export function getSessionsByClient(clientNameOrEmail) {
  const query = (clientNameOrEmail || '').trim().toLowerCase();
  if (!query) return [];
  return getAllSessions().filter((s) => {
    return (
      (s.clientEmail || '').toLowerCase() === query ||
      (s.clientName || '').toLowerCase() === query ||
      clientKey(s.clientName, s.clientEmail) === query
    );
  });
}

export function getSessionsByClientKey(key) {
  if (!key) return [];
  return getAllSessions().filter(
    (s) => clientKey(s.clientName, s.clientEmail) === key
  );
}

export function searchClients(query) {
  const q = (query || '').trim().toLowerCase();
  const all = Object.values(readClients());
  if (!q) {
    return all.sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));
  }
  return all
    .filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    )
    .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));
}

export function getAllClients() {
  return Object.values(readClients()).sort((a, b) =>
    (b.lastVisit || '').localeCompare(a.lastVisit || '')
  );
}

export function getClientByKey(key) {
  const clients = readClients();
  return clients[key] || null;
}

// Find a client by loose name/email match — useful for autocomplete
export function findClient(name, email) {
  const key = clientKey(name, email);
  const clients = readClients();
  if (clients[key]) return clients[key];
  // Try name-only match if email lookup missed
  const normName = (name || '').trim().toLowerCase();
  if (normName) {
    return (
      Object.values(clients).find(
        (c) => (c.name || '').toLowerCase() === normName
      ) || null
    );
  }
  return null;
}

export function exportAllData() {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    sessions: readSessions(),
    clients: readClients(),
    inventory: readInventory(),
  };
}

// ─── Inventory ───────────────────────────────────────────────────────────────

function readInventory() {
  if (typeof window === 'undefined') return {};
  // One-time seed of default Dermalogica products
  if (!localStorage.getItem(INVENTORY_SEEDED_KEY)) {
    const seeded = {};
    const nowIso = new Date().toISOString();
    DEFAULT_INVENTORY.forEach((p, i) => {
      const id = `prod_seed_${i}_${Math.random().toString(36).slice(2, 7)}`;
      seeded[id] = {
        id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        retailPrice: p.retailPrice,
        costPrice: p.costPrice,
        stock: p.stock,
        threshold: p.threshold,
        notes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(seeded));
    localStorage.setItem(INVENTORY_SEEDED_KEY, '1');
    return seeded;
  }
  return safeParse(localStorage.getItem(INVENTORY_KEY), {});
}

function writeInventory(inv) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv));
}

function generateProductId() {
  return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getInventory() {
  return Object.values(readInventory()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
}

export function getProduct(productId) {
  const inv = readInventory();
  return inv[productId] || null;
}

// Lookup a product by its name (used when a session stores product name).
// Returns the current inventory record or null.
export function findProductByName(name) {
  const q = (name || '').trim().toLowerCase();
  if (!q) return null;
  return (
    Object.values(readInventory()).find(
      (p) => (p.name || '').trim().toLowerCase() === q
    ) || null
  );
}

export function addProduct(productData) {
  const inv = readInventory();
  const now = new Date().toISOString();
  const product = {
    id: generateProductId(),
    name: productData.name || '',
    brand: productData.brand || 'Dermalogica',
    category: productData.category || 'Other',
    retailPrice: Number(productData.retailPrice) || 0,
    costPrice: Number(productData.costPrice) || 0,
    stock: Number(productData.stock) || 0,
    threshold: Number(productData.threshold ?? 3),
    notes: productData.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  inv[product.id] = product;
  writeInventory(inv);
  return product;
}

export function updateProduct(productId, data) {
  const inv = readInventory();
  const existing = inv[productId];
  if (!existing) return null;
  const merged = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    retailPrice: data.retailPrice !== undefined ? Number(data.retailPrice) : existing.retailPrice,
    costPrice: data.costPrice !== undefined ? Number(data.costPrice) : existing.costPrice,
    stock: data.stock !== undefined ? Number(data.stock) : existing.stock,
    threshold: data.threshold !== undefined ? Number(data.threshold) : existing.threshold,
    updatedAt: new Date().toISOString(),
  };
  inv[productId] = merged;
  writeInventory(inv);
  return merged;
}

export function deleteProduct(productId) {
  const inv = readInventory();
  if (!inv[productId]) return false;
  delete inv[productId];
  writeInventory(inv);
  return true;
}

// Change stock by a delta (negative = decrement for sale, positive = restock).
// Returns the updated product, or null if not found.
export function adjustStock(productId, quantityChange) {
  const inv = readInventory();
  const p = inv[productId];
  if (!p) return null;
  p.stock = Math.max(0, Number(p.stock || 0) + Number(quantityChange));
  p.updatedAt = new Date().toISOString();
  inv[productId] = p;
  writeInventory(inv);
  return p;
}

// Apply the delta between a previous productsSold list and a new one.
// For each product: decrement stock by (newQty - oldQty). If negative (user
// reduced qty or removed line), stock is restored.
export function applyStockDelta(oldProductsSold = [], newProductsSold = []) {
  const inv = readInventory();
  const now = new Date().toISOString();

  const oldMap = new Map();
  for (const line of oldProductsSold) {
    if (!line?.productId) continue;
    oldMap.set(line.productId, (oldMap.get(line.productId) || 0) + Number(line.quantity || 0));
  }
  const newMap = new Map();
  for (const line of newProductsSold) {
    if (!line?.productId) continue;
    newMap.set(line.productId, (newMap.get(line.productId) || 0) + Number(line.quantity || 0));
  }

  const affected = new Set([...oldMap.keys(), ...newMap.keys()]);
  for (const productId of affected) {
    const oldQty = oldMap.get(productId) || 0;
    const newQty = newMap.get(productId) || 0;
    const delta = newQty - oldQty; // positive = sold more => decrement
    if (delta === 0) continue;
    const p = inv[productId];
    if (!p) continue;
    p.stock = Math.max(0, Number(p.stock || 0) - delta);
    p.updatedAt = now;
    inv[productId] = p;
  }
  writeInventory(inv);
}

export function getLowStockProducts() {
  return getInventory().filter(
    (p) => Number(p.stock || 0) <= Number(p.threshold || 0)
  );
}

export function getOutOfStockProducts() {
  return getInventory().filter((p) => Number(p.stock || 0) === 0);
}

// Sum productSaleTotal across all sessions within [startDate, endDate] inclusive.
// Dates are ISO date-only strings ('YYYY-MM-DD'); either may be empty.
export function getProductSalesReport(startDate, endDate) {
  const all = Object.values(readSessions());
  let total = 0;
  let saleCount = 0;
  let itemCount = 0;
  const byProduct = {};
  for (const s of all) {
    const d = s.date || (s.createdAt || '').slice(0, 10);
    if (startDate && d < startDate) continue;
    if (endDate && d > endDate) continue;
    const lineTotal = Number(s.productSaleTotal || 0);
    if (lineTotal > 0) saleCount += 1;
    total += lineTotal;
    for (const line of s.productsSold || []) {
      const qty = Number(line.quantity || 0);
      itemCount += qty;
      const key = line.productId || line.name;
      if (!byProduct[key]) {
        byProduct[key] = { productId: line.productId, name: line.name, quantity: 0, revenue: 0 };
      }
      byProduct[key].quantity += qty;
      byProduct[key].revenue += Number(line.lineTotal || 0);
    }
  }
  return {
    startDate: startDate || null,
    endDate: endDate || null,
    total,
    saleCount,
    itemCount,
    byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
  };
}
