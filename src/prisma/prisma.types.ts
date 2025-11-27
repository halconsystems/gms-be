export enum PRStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum POStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

export enum GRNStatus {
  PENDING = 'PENDING',
  INSPECTING = 'INSPECTING',
  RECEIVED = 'RECEIVED',
  PARTIAL = 'PARTIAL',
  REJECTED = 'REJECTED',
}

export enum GRNType {
  PURCHASE = 'PURCHASE',
  TRANSFER = 'TRANSFER',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum ConditionStatus {
  NEW = 'NEW',
  GOOD = 'GOOD',
  USED = 'USED',
  DAMAGED = 'DAMAGED',
  MISSING = 'MISSING',
  EXPIRED = 'EXPIRED',
}

export enum MovementType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  RETURN = 'RETURN',
  ISSUANCE = 'ISSUANCE',
  CONSUMPTION = 'CONSUMPTION',
}

export enum TransferStatus {
  DRAFT = 'DRAFT',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
}

export enum IssuanceStatus {
  ISSUED = 'ISSUED',
  PARTIAL_RETURN = 'PARTIAL_RETURN',
  FULL_RETURN = 'FULL_RETURN',
  DAMAGED = 'DAMAGED',
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
