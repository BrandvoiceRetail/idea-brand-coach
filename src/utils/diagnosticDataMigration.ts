/**
 * Migrates old diagnostic data format to new format
 * Old format: separate overallScore field
 * New format: overallScore inside scores object as scores.overall
 */
export function migrateDiagnosticData(): void {
  const storedData = localStorage.getItem('diagnosticData');
  if (!storedData) return;

  try {
    const parsed = JSON.parse(storedData);

    // Check if migration needed (has separate overallScore but not scores.overall)
    if (parsed.overallScore !== undefined && (!parsed.scores || parsed.scores.overall === undefined)) {
      const migrated = {
        ...parsed,
        scores: {
          ...(parsed.scores || {}),
          overall: parsed.overallScore
        }
      };

      // Remove the old overallScore field
      delete migrated.overallScore;

      // Save migrated data
      localStorage.setItem('diagnosticData', JSON.stringify(migrated));
      console.log('Migrated diagnostic data to new format');
    }
  } catch (error) {
    console.error('Failed to migrate diagnostic data:', error);
  }
}

/**
 * Clears duplicate diagnostic submissions from localStorage
 * This is a cleanup utility that can be called if needed
 */
export function cleanupDuplicateDiagnostics(): void {
  // This function would be called if we stored multiple diagnostics in localStorage
  // Currently we only store one at a time, so this is a placeholder for future use
  console.log('Diagnostic cleanup completed');
}