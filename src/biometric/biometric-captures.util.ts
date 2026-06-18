import { Biometric } from '@prisma/client';
import { FileService } from 'src/file/file.service';
import {
  BIOMETRIC_FINGER_FIELDS,
  BiometricFingerField,
  buildBiometricStatus,
} from './biometric-status.util';

export const BIOMETRIC_FIELD_LABELS: Record<BiometricFingerField, string> = {
  rightThumb: 'Right Thumb',
  rightForeFinger: 'Right Fore Finger',
  rightMiddleFinger: 'Right Middle Finger',
  rightRingFinger: 'Right Ring Finger',
  rightLittleFinger: 'Right Little Finger',
  rightFourFinger: 'Right Four Fingers',
  leftThumb: 'Left Thumb',
  leftForeFinger: 'Left Fore Finger',
  leftMiddleFinger: 'Left Middle Finger',
  leftRingFinger: 'Left Ring Finger',
  leftLittleFinger: 'Left Little Finger',
  leftFourFinger: 'Left Four Fingers',
};

export type BiometricCaptureItem = {
  field: BiometricFingerField;
  label: string;
  imageUrl: string;
};

function isFingerComplete(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return false;
  }

  if (value === 'Left Fore Finger') {
    return false;
  }

  return true;
}

function extractS3Key(stored: string): string {
  if (!stored.startsWith('http://') && !stored.startsWith('https://')) {
    return stored;
  }

  try {
    const url = new URL(stored);
    if (url.hostname.includes('amazonaws.com')) {
      return decodeURIComponent(url.pathname.replace(/^\//, ''));
    }
  } catch {
    return stored;
  }

  return stored;
}

export async function resolveBiometricImageUrl(
  fileService: FileService,
  stored: string,
): Promise<string> {
  const trimmed = stored?.trim();
  if (!trimmed) {
    return '';
  }

  const key = extractS3Key(trimmed);
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  return fileService.getSecureDownloadUrl(key);
}

export async function buildBiometricCaptures(
  fileService: FileService,
  biometric: Biometric | null | undefined,
) {
  const status = buildBiometricStatus(biometric);
  const captures: BiometricCaptureItem[] = [];

  for (const field of BIOMETRIC_FINGER_FIELDS) {
    const stored = biometric?.[field];
    if (!isFingerComplete(stored)) {
      continue;
    }

    captures.push({
      field,
      label: BIOMETRIC_FIELD_LABELS[field],
      imageUrl: await resolveBiometricImageUrl(fileService, stored as string),
    });
  }

  return {
    ...status,
    captures,
  };
}
