import type { SerializableSession } from '@/shared/types/session';

export { createUndoFrame, restoreGameState } from '@/domain/serialization/session/frames';
export { deserializeSession } from '@/domain/serialization/session/deserialization';

type SerializeSessionOptions = {
  pretty?: boolean;
};

/** Serializes full session payload for local persistence and export. */
export function serializeSession(
  session: SerializableSession,
  options: SerializeSessionOptions = {},
): string {
  return JSON.stringify(session, null, options.pretty ? 2 : undefined);
}
