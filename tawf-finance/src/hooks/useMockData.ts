import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  mockInvestments,
  mockPurchaseOrders,
  mockComplianceDocuments,
  mockSystemAlerts,
  getInvestmentsByUserId,
  getTransactionsByUserId,
  getNotificationsByUserId,
  getComplianceDocumentsByUserId,
  formatCurrency,
  formatDate,
  daysRemaining,
  getStatusColor,
} from '@/data/mockData';

export function useMockData() {
  const { user } = useAuth();

  // Get user-specific data
  const investments = useMemo(() => {
    if (!user) return [];
    return getInvestmentsByUserId(user.id);
  }, [user]);

  const transactions = useMemo(() => {
    if (!user) return [];
    return getTransactionsByUserId(user.id);
  }, [user]);

  const notifications = useMemo(() => {
    if (!user) return [];
    return getNotificationsByUserId(user.id);
  }, [user]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const complianceDocuments = useMemo(() => {
    if (!user) return [];
    return getComplianceDocumentsByUserId(user.id);
  }, [user]);

  // Calculate portfolio stats for investors
  const portfolioStats = useMemo(() => {
    if (!user || user.role !== 'investor') return null;

    const activeInvestments = investments.filter(i => i.status === 'active');
    const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
    const totalReturns = investments.reduce((sum, i) => sum + i.currentReturn, 0);
    const expectedReturns = investments.reduce((sum, i) => sum + i.expectedReturn, 0);
    const availableBalance = 5000 - totalInvested; // Mock available balance

    return {
      totalInvested,
      totalReturns,
      expectedReturns,
      availableBalance,
      activeInvestments: activeInvestments.length,
      completedInvestments: investments.filter(i => i.status === 'completed').length,
    };
  }, [user, investments]);

  // Calculate admin stats
  const adminStats = useMemo(() => {
    if (!user || user.role !== 'admin') return null;

    const totalUsers = 2568; // Mock total (deterministic)
    const activeDeals = mockPurchaseOrders.filter(po => po.status === 'funded' || po.status === 'in_progress').length;
    const platformTVL = mockInvestments.reduce((sum, i) => sum + i.amount, 0) * 42; // Mock multiplier
    const pendingApprovals = mockComplianceDocuments.filter(d => d.status === 'pending').length;

    return {
      totalUsers,
      totalInvestments: mockInvestments.length,
      platformTVL,
      activeDeals,
      pendingApprovals,
      unresolvedAlerts: mockSystemAlerts.filter(a => !a.resolved).length,
    };
  }, [user]);

  return {
    // Data
    investments,
    transactions,
    notifications,
    unreadNotificationCount,
    complianceDocuments,
    allPurchaseOrders: mockPurchaseOrders,
    allUsers: [],
    allInvestments: mockInvestments,
    allPools: [],
    systemAlerts: mockSystemAlerts,

    // Stats
    portfolioStats,
    adminStats,

    // Utility functions
    formatCurrency,
    formatDate,
    daysRemaining,
    getStatusColor,
  };
}
