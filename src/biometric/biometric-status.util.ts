import { Biometric } from '@prisma/client';

export const BIOMETRIC_FINGER_FIELDS = [
  'rightThumb',
  'rightForeFinger',
  'rightMiddleFinger',
  'rightRingFinger',
  'rightLittleFinger',
  'rightFourFinger',
  'leftThumb',
  'leftForeFinger',
  'leftMiddleFinger',
  'leftRingFinger',
  'leftLittleFinger',
  'leftFourFinger',
] as const;

export type BiometricFingerField = (typeof BIOMETRIC_FINGER_FIELDS)[number];

export type BiometricStatusResult = {
  status: 'Done' | 'Pending';
  completedFingers: number;
  totalFingers: number;
  fingers: Record<BiometricFingerField, boolean>;
};

function isFingerComplete(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return false;
  }

  // Prisma default placeholder on leftForeFinger — not a real capture
  if (value === 'Left Fore Finger') {
    return false;
  }

  return true;
}

export function buildBiometricStatus(
  biometric: Biometric | null | undefined,
): BiometricStatusResult {
  const fingers = {} as Record<BiometricFingerField, boolean>;
  let completedFingers = 0;

  for (const field of BIOMETRIC_FINGER_FIELDS) {
    const complete = isFingerComplete(biometric?.[field]);
    fingers[field] = complete;
    if (complete) {
      completedFingers += 1;
    }
  }

  const totalFingers = BIOMETRIC_FINGER_FIELDS.length;

  return {
    status: completedFingers === totalFingers ? 'Done' : 'Pending',
    completedFingers,
    totalFingers,
    fingers,
  };
}
