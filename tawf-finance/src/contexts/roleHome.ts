import type { UserRole } from '@/data/mockData';

/** Where each role lands after sign in, and the only area it may open. */
export const ROLE_HOME: Record<UserRole, string> = {
  investor: '/investor/dashboard',
  business: '/investor/dashboard',
  cooperative: '/investor/dashboard',
  issuer: '/issuer/ops',
  admin: '/admin/dashboard',
};
