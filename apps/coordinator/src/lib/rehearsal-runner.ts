/**
 * Run a rehearsal body and its teardown without allowing teardown failures to
 * hide the assertion or runtime failure that made the rehearsal fail.
 */
export async function runWithPreservedFailure<T>(
  run: () => Promise<T>,
  teardown: () => Promise<void>,
): Promise<T> {
  let primaryFailure: unknown;
  try {
    return await run();
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      await teardown();
    } catch (teardownError) {
      if (primaryFailure === undefined) throw teardownError;
    }
  }
}
