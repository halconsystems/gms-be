/**
 * Generic paginated response interface
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Common inventory query options for filtering
 */
export interface InventoryQueryOptions {
  organizationId: string;
  skip?: number;
  take?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Response wrapper for API responses
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
