import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  mockInvestments,
  mockPurchaseOrders,
  mockComplianceDocuments,
  mockBusinessProfiles,
  mockSystemAlerts,
  getInvestmentsByUserId,
  getTransactionsByUserId,
  getNotificationsByUserId,
  getPurchaseOrdersByBusinessId,
  getVendorServicesByVendorId,
  getPartnershipsByVendorId,
  getPartnershipsByCooperativeId,
  getComplianceDocumentsByUserId,
  getBusinessProfileByUserId,
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
    return getInvestmentsByUserId(user.address);
  }, [user]);

  const transactions = useMemo(() => {
    if (!user) return [];
    return getTransactionsByUserId(user.address);
  }, [user]);

  const notifications = useMemo(() => {
    if (!user) return [];
    return getNotificationsByUserId(user.address);
  }, [user]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const purchaseOrders = useMemo(() => {
    if (!user) return [];
    return getPurchaseOrdersByBusinessId(user.address);
  }, [user]);

  const vendorServices = useMemo(() => {
    if (!user) return [];
    return getVendorServicesByVendorId(user.address);
  }, [user]);

  const vendorPartnerships = useMemo(() => {
    if (!user) return [];
    return getPartnershipsByVendorId(user.address);
  }, [user]);

  const cooperativePartnerships = useMemo(() => {
    if (!user) return [];
    return getPartnershipsByCooperativeId(user.address);
  }, [user]);

  const complianceDocuments = useMemo(() => {
    if (!user) return [];
    return getComplianceDocumentsByUserId(user.address);
  }, [user]);

  const businessProfile = useMemo(() => {
    if (!user) return undefined;
    return getBusinessProfileByUserId(user.address);
  }, [user]);

  // Calculate portfolio stats for investors
  const portfolioStats = useMemo(() => {
    if (!user) return null;

    const activeInvestments = investments.filter(i => i.status === 'active');
    const totalInvested = investments.reduce((sum, i) => sum + i.amount, 0);
    const totalReturns = investments.reduce((sum, i) => sum + i.currentReturn, 0);
    const expectedReturns = investments.reduce((sum, i) => sum + i.expectedReturn, 0);
    const availableBalance = 5000 - totalInvested;

    return {
      totalInvested,
      totalReturns,
      expectedReturns,
      availableBalance,
      activeInvestments: activeInvestments.length,
      completedInvestments: investments.filter(i => i.status === 'completed').length,
    };
  }, [user, investments]);

  // Calculate vendor stats
  const vendorStats = useMemo(() => {
    if (!user) return null;

    const activeServices = vendorServices.filter(s => s.active).length;
    const totalOrders = vendorServices.reduce((sum, s) => sum + s.ordersFulfilled, 0);
    const averageRating = vendorServices.length > 0
      ? vendorServices.reduce((sum, s) => sum + s.rating, 0) / vendorServices.length
      : 0;

    return {
      activeServices,
      totalOrders,
      averageRating,
      activePartnerships: vendorPartnerships.filter(p => p.status === 'active').length,
      totalEarnings: vendorPartnerships.reduce((sum, p) => sum + p.totalValue, 0),
    };
  }, [user, vendorServices, vendorPartnerships]);

  // Calculate cooperative stats
  const cooperativeStats = useMemo(() => {
    if (!user) return null;

    const pendingVerifications = mockPurchaseOrders.filter(po => po.status === 'verifying').length;
    const fundedDeals = mockPurchaseOrders.filter(po => po.status === 'funded' || po.status === 'in_progress').length;
    const totalDisbursed = mockPurchaseOrders
      .filter(po => po.status === 'funded' || po.status === 'in_progress' || po.status === 'fulfilled' || po.status === 'repaid')
      .reduce((sum, po) => sum + po.amount, 0);

    return {
      pendingVerifications,
      activeDeals: fundedDeals,
      totalDisbursed,
      verifiedBusinesses: mockBusinessProfiles.filter(b => b.verifiedBy.includes(user.address)).length,
      memberCount: 145,
    };
  }, [user]);

  // Calculate business stats
  const businessStats = useMemo(() => {
    if (!user) return null;

    const activePOs = purchaseOrders.filter(po => po.status === 'funded' || po.status === 'in_progress').length;
    const totalFunding = purchaseOrders
      .filter(po => po.status === 'funded' || po.status === 'in_progress' || po.status === 'fulfilled' || po.status === 'repaid')
      .reduce((sum, po) => sum + po.amount, 0);
    const pendingPOs = purchaseOrders.filter(po => po.status === 'submitted' || po.status === 'verifying').length;

    return {
      activePOs,
      totalFunding,
      pendingPOs,
      completedPOs: purchaseOrders.filter(po => po.status === 'repaid').length,
      tawfScore: businessProfile?.tawfScore || 0,
      nextPaymentDue: purchaseOrders
        .filter(po => po.status === 'funded' || po.status === 'in_progress')
        .sort((a, b) => new Date(a.repaymentDue || '').getTime() - new Date(b.repaymentDue || '').getTime())[0]
        ?.repaymentDue,
    };
  }, [user, purchaseOrders, businessProfile]);

  // Calculate admin stats
  const adminStats = useMemo(() => {
    if (!user) return null;

    const totalUsers = 2480;
    const activeDeals = mockPurchaseOrders.filter(po => po.status === 'funded' || po.status === 'in_progress').length;
    const platformTVL = mockInvestments.reduce((sum, i) => sum + i.amount, 0) * 42;
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
    purchaseOrders,
    vendorServices,
    vendorPartnerships,
    cooperativePartnerships,
    complianceDocuments,
    businessProfile,
    allPurchaseOrders: mockPurchaseOrders,
    allBusinessProfiles: mockBusinessProfiles,
    allUsers: [],
    allInvestments: mockInvestments,
    allPools: [],
    systemAlerts: mockSystemAlerts,

    // Stats
    portfolioStats,
    vendorStats,
    cooperativeStats,
    businessStats,
    adminStats,

    // Utility functions
    formatCurrency,
    formatDate,
    daysRemaining,
    getStatusColor,
  };
}
