export const GUARD_MIN_AGE = 21;
export const GUARD_MAX_AGE = 65;

export function calculateAge(dateOfBirth: Date, referenceDate = new Date()): number {
  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = referenceDate.getMonth() - dateOfBirth.getMonth();
  const dayDiff = referenceDate.getDate() - dateOfBirth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}

export function validateGuardAge(dateOfBirth: Date): string | null {
  const age = calculateAge(dateOfBirth);

  if (age < GUARD_MIN_AGE) {
    return `Guard must be at least ${GUARD_MIN_AGE} years old`;
  }

  if (age > GUARD_MAX_AGE) {
    return `Guard age must not exceed ${GUARD_MAX_AGE} years`;
  }

  return null;
}
