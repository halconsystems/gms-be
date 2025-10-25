/**
 * Whether overtime can only be set on Present (P) attendance records.
 * Set to 'true' to enforce, 'false' to allow overtime on any attendance type.
 * Default: false (no enforcement) as per business requirements.
 */
export const ENFORCE_PRESENT_ONLY_OVERTIME = process.env.ENFORCE_PRESENT_ONLY_OVERTIME === 'true';