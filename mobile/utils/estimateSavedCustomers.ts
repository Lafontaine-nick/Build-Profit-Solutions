import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedEstimateCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  company: string;
  notes: string;
  bidCount: number;
  lastUsedAt: string;
  recentProjects: string[];
};

type CustomerDraft = Omit<SavedEstimateCustomer, 'id' | 'bidCount' | 'lastUsedAt' | 'recentProjects'>;

type StoredSavedCustomer = SavedEstimateCustomer & { bidIds?: string[] };

export const SAVED_ESTIMATE_CUSTOMERS_KEY = 'bps.savedEstimateCustomers';
export const SAVED_ESTIMATE_CUSTOMERS_HIDDEN_KEY = 'bps.savedEstimateCustomersHidden';

export type SavedCustomerHiddenKeys = {
  ids: string[];
  names: string[];
};

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Match duplicates: normalized email → phone → name + address. */
export function customerDedupeKey(customer: CustomerDraft): string | null {
  const email = customer.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = customer.phone.replace(/\D/g, '');
  if (phone.length >= 7) return `phone:${phone}`;
  const name = customer.name.trim().toLowerCase();
  const address = normalizeAddress(customer.address);
  if (name && address) return `name:${name}|addr:${address}`;
  if (name) return `name:${name}`;
  return null;
}

function extractBidId(record: unknown): string {
  if (!record || typeof record !== 'object') return '';
  return String((record as Record<string, unknown>).id || '').trim();
}

function extractCustomerFromRecord(record: unknown): CustomerDraft | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  const estimateData =
    r.estimateData && typeof r.estimateData === 'object'
      ? (r.estimateData as Record<string, unknown>)
      : null;

  const name = pickString(
    r.customerName,
    r.clientName,
    r.client,
    estimateData?.customerName,
    estimateData?.clientName
  );
  if (!name) return null;

  const locationText = pickString(r.location, estimateData?.location);
  let city = pickString(r.customerCity, r.city, estimateData?.customerCity);
  let state = pickString(r.customerState, r.state, estimateData?.customerState);
  if ((!city || !state) && locationText && !locationText.toLowerCase().includes('unknown')) {
    const parts = locationText.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = city || parts[0];
      state = state || parts[1];
    } else if (!city) {
      city = parts[0] || '';
    }
  }

  return {
    name,
    email: pickString(
      r.customerEmail,
      r.clientEmail,
      estimateData?.customerEmail,
      estimateData?.clientEmail
    ),
    phone: pickString(
      r.customerPhone,
      r.clientPhone,
      estimateData?.customerPhone,
      estimateData?.clientPhone
    ),
    address: pickString(r.customerAddress, estimateData?.customerAddress),
    city,
    state,
    zip: pickString(r.customerZip, r.zip, estimateData?.customerZip),
    company: pickString(r.customerCompany, r.clientCompany, estimateData?.customerCompany),
    notes: pickString(r.customerNotes, estimateData?.customerNotes),
  };
}

function recordTimestamp(record: unknown): string {
  if (!record || typeof record !== 'object') return new Date(0).toISOString();
  const r = record as Record<string, unknown>;
  const raw =
    r.updatedAt ||
    r.lastUpdated ||
    r.timestamp ||
    r.createdAt ||
    r.startDate ||
    new Date().toISOString();
  return String(raw);
}

function recordTitle(record: unknown, fallback = ''): string {
  if (!record || typeof record !== 'object') return fallback;
  const r = record as Record<string, unknown>;
  return pickString(r.title, r.name, fallback);
}

type CollectSources = {
  savedEstimates?: unknown[];
  projects?: unknown[];
  excludeBidId?: string;
};

function customerNamesMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function customerMatchesSavedEntry(
  entry: SavedEstimateCustomer,
  draft: CustomerDraft
): boolean {
  const draftKey = customerDedupeKey(draft);
  if (draftKey && draftKey === entry.id) return true;
  return customerNamesMatch(entry.name, draft.name);
}

function mergeSavedCustomerRecord(
  base: SavedEstimateCustomer,
  incoming: CustomerDraft
): SavedEstimateCustomer {
  const merged = mergeCustomerFields(base, incoming);
  return {
    ...base,
    ...merged,
  };
}

export function enrichSavedCustomerFromSources(
  customer: SavedEstimateCustomer,
  sources: CollectSources
): SavedEstimateCustomer {
  let enriched: SavedEstimateCustomer = { ...customer };

  const tryMergeRecord = (record: unknown) => {
    const draft = extractCustomerFromRecord(record);
    if (!draft || !customerMatchesSavedEntry(customer, draft)) return;
    enriched = mergeSavedCustomerRecord(enriched, draft);
  };

  for (const entry of sources.savedEstimates || []) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const data = row.data && typeof row.data === 'object' ? row.data : row;
    tryMergeRecord(data);
  }

  for (const project of sources.projects || []) {
    if (!project || typeof project !== 'object') continue;
    const row = project as Record<string, unknown>;
    tryMergeRecord(row);
    if (row.estimateData && typeof row.estimateData === 'object') {
      tryMergeRecord(row.estimateData);
    }
  }

  return enriched;
}

function mergeCustomerFields(existing: CustomerDraft, incoming: CustomerDraft): CustomerDraft {
  return {
    name: incoming.name || existing.name,
    email: incoming.email || existing.email,
    phone: incoming.phone || existing.phone,
    address: incoming.address || existing.address,
    city: incoming.city || existing.city,
    state: incoming.state || existing.state,
    zip: incoming.zip || existing.zip,
    company: incoming.company || existing.company,
    notes: incoming.notes || existing.notes,
  };
}

function stripInternal(customers: StoredSavedCustomer[]): SavedEstimateCustomer[] {
  return customers.map(({ bidIds: _bidIds, ...customer }) => ({
    ...customer,
    bidCount: sanitizeBidCount(customer.bidCount),
  }));
}

/** Cap unrealistic inflated counts for display. */
export function sanitizeBidCount(bidCount: number): number {
  const count = Math.max(0, Math.floor(bidCount));
  if (count <= 0) return 1;
  return Math.min(count, 9);
}

export function formatSavedCustomerBidPill(bidCount: number): string {
  const count = sanitizeBidCount(bidCount);
  if (count <= 1) return 'Use';
  if (count >= 9) return '9+ bids';
  return `${count} bids`;
}

export function formatSavedCustomerSecondaryDetail(customer: SavedEstimateCustomer): string {
  if (customer.phone) return customer.phone;
  if (customer.email) return customer.email;
  if (customer.city && customer.state) return `${customer.city}, ${customer.state}`;
  if (customer.city) return customer.city;
  if (customer.state) return customer.state;
  return '';
}

function sortCustomers(customers: SavedEstimateCustomer[]): SavedEstimateCustomer[] {
  return [...customers].sort((a, b) => {
    if (b.bidCount !== a.bidCount) return b.bidCount - a.bidCount;
    return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
  });
}

export async function loadSavedEstimateCustomers(): Promise<SavedEstimateCustomer[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ESTIMATE_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return stripInternal(parsed as StoredSavedCustomer[]);
  } catch {
    return [];
  }
}

async function persistSavedEstimateCustomers(customers: StoredSavedCustomer[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_ESTIMATE_CUSTOMERS_KEY, JSON.stringify(customers));
}

export async function upsertSavedCustomerFromBid(
  bid: Record<string, unknown>,
  options: { bidId?: string; projectTitle?: string } = {}
): Promise<SavedEstimateCustomer[]> {
  const customer = extractCustomerFromRecord(bid);
  const key = customer ? customerDedupeKey(customer) : null;
  if (!customer || !key) return loadSavedEstimateCustomers();

  const raw = await AsyncStorage.getItem(SAVED_ESTIMATE_CUSTOMERS_KEY);
  const list: StoredSavedCustomer[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(list)) {
    await persistSavedEstimateCustomers([]);
    return [];
  }

  const bidId = String(options.bidId || bid.id || '').trim();
  const projectTitle = String(options.projectTitle || bid.title || '').trim();
  const now = new Date().toISOString();

  const existingIndex = list.findIndex(
    (row) => row.id === key || customerDedupeKey(row) === key
  );

  if (existingIndex < 0) {
    list.push({
      id: key,
      ...customer,
      bidCount: 1,
      lastUsedAt: now,
      recentProjects: projectTitle ? [projectTitle] : [],
      bidIds: bidId ? [bidId] : [],
    });
  } else {
    const existing = list[existingIndex];
    const merged = mergeCustomerFields(existing, customer);
    const bidIds = Array.isArray(existing.bidIds) ? [...existing.bidIds] : [];

    if (bidId && !bidIds.includes(bidId)) {
      bidIds.push(bidId);
    }

    const recentProjects = [...(existing.recentProjects || [])];
    if (projectTitle && !recentProjects.includes(projectTitle)) {
      recentProjects.unshift(projectTitle);
    }

    list[existingIndex] = {
      ...existing,
      ...merged,
      id: key,
      bidIds,
      bidCount: bidIds.length > 0 ? bidIds.length : Math.max(existing.bidCount, 1),
      lastUsedAt: now,
      recentProjects: recentProjects.slice(0, 4),
    };
  }

  await persistSavedEstimateCustomers(list);
  return sortCustomers(stripInternal(list));
}

/** Merge customers from saved bids and projects (one row per bid id). */
export function collectSavedEstimateCustomers({
  savedEstimates = [],
  projects = [],
  excludeBidId,
}: CollectSources): SavedEstimateCustomer[] {
  const byKey = new Map<string, SavedEstimateCustomer & { projectSet: Set<string>; bidIds: Set<string> }>();
  const seenBidIds = new Set<string>();

  const ingest = (record: unknown, titleHint = '', ts?: string, bidIdHint = '') => {
    const bidId = bidIdHint || extractBidId(record);
    if (excludeBidId && bidId === excludeBidId) return;
    if (bidId) {
      if (seenBidIds.has(bidId)) return;
      seenBidIds.add(bidId);
    }

    const customer = extractCustomerFromRecord(record);
    const key = customer ? customerDedupeKey(customer) : null;
    if (!customer || !key) return;

    const usedAt = ts || recordTimestamp(record);
    const projectLabel = titleHint || recordTitle(record);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        id: key,
        ...customer,
        bidCount: 1,
        lastUsedAt: usedAt,
        recentProjects: projectLabel ? [projectLabel] : [],
        projectSet: new Set(projectLabel ? [projectLabel] : []),
        bidIds: new Set(bidId ? [bidId] : []),
      });
      return;
    }

    if (bidId) existing.bidIds.add(bidId);
    existing.bidCount = existing.bidIds.size > 0 ? existing.bidIds.size : existing.bidCount + 1;

    Object.assign(existing, mergeCustomerFields(existing, customer));
    if (new Date(usedAt).getTime() > new Date(existing.lastUsedAt).getTime()) {
      existing.lastUsedAt = usedAt;
    }

    if (projectLabel && !existing.projectSet.has(projectLabel)) {
      existing.projectSet.add(projectLabel);
      existing.recentProjects = [projectLabel, ...existing.recentProjects].slice(0, 4);
    }
  };

  for (const entry of savedEstimates) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const bidId = String(row.id || '').trim();
    if (excludeBidId && bidId === excludeBidId) continue;
    const data = row.data && typeof row.data === 'object' ? row.data : row;
    ingest(data, recordTitle(row), String(row.timestamp || recordTimestamp(data)), bidId);
  }

  for (const project of projects) {
    if (!project || typeof project !== 'object') continue;
    const row = project as Record<string, unknown>;
    const bidId = String(row.id || '').trim();
    if (excludeBidId && bidId === excludeBidId) continue;
    ingest(row, recordTitle(row), undefined, bidId);
  }

  return sortCustomers(
    Array.from(byKey.values()).map(({ projectSet: _projectSet, bidIds: _bidIds, ...customer }) => ({
      ...customer,
      bidCount: sanitizeBidCount(customer.bidCount),
    }))
  );
}

/** Prefer persisted customers; merge in richer derived contact fields when available. */
export function mergeSavedCustomersForPicker(
  persisted: SavedEstimateCustomer[],
  derived: SavedEstimateCustomer[]
): SavedEstimateCustomer[] {
  const byKey = new Map<string, SavedEstimateCustomer>();

  for (const customer of persisted) {
    byKey.set(customer.id, customer);
  }

  for (const customer of derived) {
    const existingById = byKey.get(customer.id);
    if (existingById) {
      byKey.set(customer.id, mergeSavedCustomerRecord(existingById, customer));
      continue;
    }

    const existingByName = Array.from(byKey.values()).find((entry) =>
      customerNamesMatch(entry.name, customer.name)
    );
    if (existingByName) {
      byKey.set(existingByName.id, mergeSavedCustomerRecord(existingByName, customer));
    } else {
      byKey.set(customer.id, customer);
    }
  }

  return sortCustomers(Array.from(byKey.values()));
}

function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase();
}

export async function loadHiddenSavedCustomerKeys(): Promise<SavedCustomerHiddenKeys> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ESTIMATE_CUSTOMERS_HIDDEN_KEY);
    if (!raw) return { ids: [], names: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ids: [], names: [] };
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.map((id: unknown) => String(id).trim()).filter(Boolean)
      : [];
    const names = Array.isArray(parsed.names)
      ? parsed.names.map((name: unknown) => normalizeCustomerName(String(name))).filter(Boolean)
      : [];
    return { ids, names };
  } catch {
    return { ids: [], names: [] };
  }
}

async function persistHiddenSavedCustomerKeys(hidden: SavedCustomerHiddenKeys): Promise<void> {
  await AsyncStorage.setItem(SAVED_ESTIMATE_CUSTOMERS_HIDDEN_KEY, JSON.stringify(hidden));
}

export function isSavedCustomerHidden(
  customer: SavedEstimateCustomer,
  hidden: SavedCustomerHiddenKeys
): boolean {
  const hiddenIds = new Set(hidden.ids);
  const hiddenNames = new Set(hidden.names);
  if (hiddenIds.has(customer.id)) return true;
  const name = normalizeCustomerName(customer.name);
  return Boolean(name && hiddenNames.has(name));
}

export function filterHiddenSavedCustomers(
  customers: SavedEstimateCustomer[],
  hidden: SavedCustomerHiddenKeys
): SavedEstimateCustomer[] {
  if (!hidden.ids.length && !hidden.names.length) return customers;
  return customers.filter((customer) => !isSavedCustomerHidden(customer, hidden));
}

/** Remove from persisted storage and hide derived re-entries in the picker. */
export async function removeSavedCustomerFromPicker(
  customer: SavedEstimateCustomer
): Promise<{ customers: SavedEstimateCustomer[]; hidden: SavedCustomerHiddenKeys }> {
  const hidden = await loadHiddenSavedCustomerKeys();
  const nextHidden: SavedCustomerHiddenKeys = {
    ids: Array.from(new Set([...hidden.ids, customer.id])),
    names: Array.from(
      new Set([...hidden.names, normalizeCustomerName(customer.name)].filter(Boolean))
    ),
  };
  await persistHiddenSavedCustomerKeys(nextHidden);

  const raw = await AsyncStorage.getItem(SAVED_ESTIMATE_CUSTOMERS_KEY);
  const list: StoredSavedCustomer[] = raw ? JSON.parse(raw) : [];
  const targetName = normalizeCustomerName(customer.name);
  const filtered = Array.isArray(list)
    ? list.filter((row) => {
        if (row.id === customer.id) return false;
        if (customerDedupeKey(row) === customer.id) return false;
        if (targetName && normalizeCustomerName(row.name) === targetName) return false;
        return true;
      })
    : [];

  await persistSavedEstimateCustomers(filtered);
  return {
    customers: sortCustomers(stripInternal(filtered)),
    hidden: nextHidden,
  };
}
