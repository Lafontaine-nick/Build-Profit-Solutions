import businessWorkspaceService, {
  type WorkspaceBootstrapPayload,
} from '@/services/businessWorkspaceService';

const TTL_MS = 5000;

let cached: { at: number; data: WorkspaceBootstrapPayload } | null = null;
let inflight: Promise<WorkspaceBootstrapPayload | null> | null = null;

export function invalidateWorkspaceBootstrapCache(): void {
  cached = null;
  inflight = null;
}

/** Deduped workspace bootstrap — accept invite, access, roster, and member projects in one request. */
export async function fetchWorkspaceBootstrap(options?: {
  force?: boolean;
}): Promise<WorkspaceBootstrapPayload | null> {
  const force = options?.force === true;
  const now = Date.now();
  if (!force && cached && now - cached.at < TTL_MS) {
    return cached.data;
  }
  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const response = await businessWorkspaceService.getWorkspaceBootstrap();
      if (!response.success || !response.data) {
        return cached?.data ?? null;
      }
      cached = { at: Date.now(), data: response.data };
      return response.data;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
