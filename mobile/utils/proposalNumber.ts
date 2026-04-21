import AsyncStorage from '@react-native-async-storage/async-storage';

const PROPOSAL_SEQ_KEY = '@bps_proposal_seq_next';

/**
 * Next human-readable proposal # for new estimates (1, 2, 3…).
 * Internal `bid.id` stays a timestamp for storage/sync; this is display-only ref.
 */
export async function allocateNextProposalNumber(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(PROPOSAL_SEQ_KEY);
    let next = raw != null ? parseInt(raw, 10) : 1;
    if (!Number.isFinite(next) || next < 1) next = 1;
    await AsyncStorage.setItem(PROPOSAL_SEQ_KEY, String(next + 1));
    return next;
  } catch {
    return Math.floor(Date.now() % 1_000_000) + 1;
  }
}

/**
 * Shown as "Proposal #…" on PDFs. Prefer sequential `proposalNumber`; otherwise shorten timestamp id.
 */
export function formatProposalIdForContract(bidData: {
  id?: string;
  proposalNumber?: number | null;
}): string {
  const n = bidData.proposalNumber;
  if (n != null && Number.isFinite(Number(n)) && Number(n) > 0) {
    return String(Math.floor(Number(n)));
  }
  const raw = String(bidData.id || '').trim();
  if (/^\d{10,}$/.test(raw)) {
    return raw.slice(-5);
  }
  return raw || '—';
}
