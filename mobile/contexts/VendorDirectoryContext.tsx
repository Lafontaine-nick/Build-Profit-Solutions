import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TaxCategory } from '@/src/lib/taxCenter';
import {
  defaultVendorDirectorySnapshot,
  loadVendorDirectorySnapshot,
  saveVendorDirectorySnapshot,
  type VendorDirectorySnapshot,
} from '@/src/lib/vendorDirectoryStorage';
import type { AccountingIntegration, Vendor, VendorType, W9Status } from '@/src/lib/vendorTypes';

type VendorDirectoryContextValue = {
  hydrated: boolean;
  vendors: Vendor[];
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
  integrations: AccountingIntegration[];
  userId: string;
  addVendor: (input: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Vendor;
  updateVendor: (id: string, patch: Partial<Vendor>) => void;
  removeVendor: (id: string) => void;
  setQuickBooksCategoryMap: (map: Partial<Record<TaxCategory, string>>) => void;
  setIntegrations: (list: AccountingIntegration[]) => void;
};

const VendorDirectoryContext = createContext<VendorDirectoryContextValue | null>(null);

function newId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function VendorDirectoryProvider({
  children,
  clerkUserId,
}: {
  children: React.ReactNode;
  /** Clerk user id when signed in; omit or null for anonymous / dev-without-Clerk. */
  clerkUserId: string | null;
}) {
  const userId = clerkUserId ?? 'anonymous';
  const [hydrated, setHydrated] = useState(false);
  const [snapshot, setSnapshot] = useState<VendorDirectorySnapshot>(() => defaultVendorDirectorySnapshot());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadVendorDirectorySnapshot();
      if (!cancelled) {
        setSnapshot(loaded);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorsForUser = useMemo(
    () => snapshot.vendors.filter((v) => v.userId === userId),
    [snapshot.vendors, userId]
  );

  const persist = useCallback(
    (next: VendorDirectorySnapshot) => {
      setSnapshot(next);
      void saveVendorDirectorySnapshot(next);
    },
    []
  );

  const addVendor = useCallback(
    (input: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
      const now = new Date().toISOString();
      const v: Vendor = {
        ...input,
        id: newId(),
        userId,
        createdAt: now,
        updatedAt: now,
      };
      const next: VendorDirectorySnapshot = {
        ...snapshot,
        vendors: [...snapshot.vendors, v],
      };
      persist(next);
      return v;
    },
    [persist, snapshot, userId]
  );

  const updateVendor = useCallback(
    (id: string, patch: Partial<Vendor>) => {
      const now = new Date().toISOString();
      const nextVendors = snapshot.vendors.map((v) =>
        v.id === id && v.userId === userId ? { ...v, ...patch, updatedAt: now } : v
      );
      persist({ ...snapshot, vendors: nextVendors });
    },
    [persist, snapshot, userId]
  );

  const removeVendor = useCallback(
    (id: string) => {
      persist({
        ...snapshot,
        vendors: snapshot.vendors.filter((v) => !(v.id === id && v.userId === userId)),
      });
    },
    [persist, snapshot, userId]
  );

  const setQuickBooksCategoryMap = useCallback(
    (map: Partial<Record<TaxCategory, string>>) => {
      persist({ ...snapshot, quickBooksCategoryMap: { ...snapshot.quickBooksCategoryMap, ...map } });
    },
    [persist, snapshot]
  );

  const setIntegrations = useCallback(
    (list: AccountingIntegration[]) => {
      persist({ ...snapshot, integrations: list });
    },
    [persist, snapshot]
  );

  const value = useMemo<VendorDirectoryContextValue>(
    () => ({
      hydrated,
      vendors: vendorsForUser,
      quickBooksCategoryMap: snapshot.quickBooksCategoryMap,
      integrations: snapshot.integrations,
      userId,
      addVendor,
      updateVendor,
      removeVendor,
      setQuickBooksCategoryMap,
      setIntegrations,
    }),
    [
      hydrated,
      vendorsForUser,
      snapshot.quickBooksCategoryMap,
      snapshot.integrations,
      userId,
      addVendor,
      updateVendor,
      removeVendor,
      setQuickBooksCategoryMap,
      setIntegrations,
    ]
  );

  return <VendorDirectoryContext.Provider value={value}>{children}</VendorDirectoryContext.Provider>;
}

/** Use when Clerk is not available (dev / anonymous). */
export function VendorDirectoryProviderLocal({ children }: { children: React.ReactNode }) {
  return <VendorDirectoryProvider clerkUserId={null}>{children}</VendorDirectoryProvider>;
}

export function useVendorDirectory(): VendorDirectoryContextValue {
  const ctx = useContext(VendorDirectoryContext);
  if (!ctx) {
    throw new Error('useVendorDirectory must be used within VendorDirectoryProvider');
  }
  return ctx;
}

export type { Vendor, VendorType, W9Status };
export { isReviewableVendorType } from '@/src/lib/vendorTypes';
