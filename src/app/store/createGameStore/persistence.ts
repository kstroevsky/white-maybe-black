import { deserializeSession, withRuleDefaults, type RuleConfig } from '@/domain';
import { LEGACY_SESSION_STORAGE_KEYS, SESSION_STORAGE_KEY } from '@/shared/constants/storage';
import type { SerializableSession } from '@/shared/types/session';

import { LEGACY_RULE_DEFAULTS } from '@/app/store/createGameStore/constants';
import { createSessionId, getDefaultSession } from '@/app/store/createGameStore/session';
import type { InitialPersistenceState, StoreOptions } from '@/app/store/createGameStore/types';
import {
  createCompactSession,
  createPersistedSessionEnvelope,
  deserializePersistedSessionEnvelope,
  LOCAL_HISTORY_WINDOW,
  serializePersistedSessionEnvelope,
} from '@/app/store/sessionPersistence';

/** Removes legacy storage keys once the v4 envelope has been written. */
export function clearLegacySessionKeys(storage?: Storage): void {
  if (!storage) {
    return;
  }

  for (const legacyKey of LEGACY_SESSION_STORAGE_KEYS) {
    storage.removeItem(legacyKey);
  }
}

/** Writes the compact local session envelope and swallows quota/storage failures. */
export function persistSessionSnapshot(
  session: SerializableSession,
  sessionId: string,
  revision: number,
  storage?: Storage,
): boolean {
  if (!storage) {
    return true;
  }

  const serialized = serializePersistedSessionEnvelope(
    createPersistedSessionEnvelope(
      'compact',
      sessionId,
      revision,
      createCompactSession(session, LOCAL_HISTORY_WINDOW),
    ),
  );

  clearLegacySessionKeys(storage);

  try {
    storage.setItem(SESSION_STORAGE_KEY, serialized);
    return true;
  } catch {
    storage.removeItem(SESSION_STORAGE_KEY);

    try {
      storage.setItem(SESSION_STORAGE_KEY, serialized);
      return true;
    } catch {
      storage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }
  }
}

/** Detects the old default rules that were persisted before the default-policy change. */
export function hasLegacyRuleDefaults(ruleConfig: RuleConfig): boolean {
  return (
    ruleConfig.allowNonAdjacentFriendlyStackTransfer ===
      LEGACY_RULE_DEFAULTS.allowNonAdjacentFriendlyStackTransfer &&
    ruleConfig.drawRule === LEGACY_RULE_DEFAULTS.drawRule &&
    ruleConfig.scoringMode === LEGACY_RULE_DEFAULTS.scoringMode
  );
}

/** Limits default migration to untouched sessions so active games remain unchanged. */
export function isUntouchedSession(session: SerializableSession): boolean {
  return (
    session.turnLog.length === 0 &&
    session.past.length === 0 &&
    session.future.length === 0 &&
    session.present.historyCursor === 0
  );
}

/** Migrates stale untouched sessions to the current rule defaults. */
export function migrateLegacyRuleDefaults(
  session: SerializableSession,
): { session: SerializableSession; migrated: boolean } {
  if (!hasLegacyRuleDefaults(session.ruleConfig) || !isUntouchedSession(session)) {
    return { session, migrated: false };
  }

  return {
    session: {
      ...session,
      ruleConfig: withRuleDefaults(),
    },
    migrated: true,
  };
}

/** Reads the best synchronous session snapshot before async archive hydration begins. */
export function getInitialPersistenceState(options: StoreOptions): InitialPersistenceState {
  const createId = options.createSessionId ?? createSessionId;
  const archiveAvailable = options.archive !== null && options.archive !== undefined;

  if (options.initialSession) {
    return {
      historyHydrationStatus: 'full',
      needsPersistenceSync: false,
      revision: 0,
      session: options.initialSession,
      sessionId: createId(),
      startupHydrationMode: null,
    };
  }

  if (options.storage) {
    const candidateKeys = [SESSION_STORAGE_KEY, ...LEGACY_SESSION_STORAGE_KEYS];

    for (const storageKey of candidateKeys) {
      const serialized = options.storage.getItem(storageKey);

      if (!serialized) {
        continue;
      }

      try {
        if (storageKey === SESSION_STORAGE_KEY) {
          const envelope = deserializePersistedSessionEnvelope(serialized);
          const { session, migrated } = migrateLegacyRuleDefaults(envelope.session);

          return {
            historyHydrationStatus: archiveAvailable ? 'hydrating' : 'recentOnly',
            needsPersistenceSync: migrated,
            revision: envelope.revision,
            session,
            sessionId: envelope.sessionId,
            startupHydrationMode: archiveAvailable ? 'compact' : null,
          };
        }

        const deserialized = deserializeSession(serialized);
        const { session } = migrateLegacyRuleDefaults(deserialized);

        return {
          historyHydrationStatus: 'full',
          needsPersistenceSync: true,
          revision: 0,
          session,
          sessionId: createId(),
          startupHydrationMode: null,
        };
      } catch {
        options.storage.removeItem(storageKey);
      }
    }
  }

  return {
    historyHydrationStatus: archiveAvailable ? 'hydrating' : 'full',
    needsPersistenceSync: false,
    revision: 0,
    session: getDefaultSession(),
    sessionId: createId(),
    startupHydrationMode: archiveAvailable ? 'default' : null,
  };
}
