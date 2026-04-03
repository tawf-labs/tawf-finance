// Mock Data Layer for Tawf Finance Prototype
// Comprehensive mock data for all user types and dashboard scenarios

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'investor' | 'vendor' | 'cooperative' | 'business' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'active' | 'suspended' | 'pending_verification';
  joinedAt: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  walletAddress?: string;
  kycVerified: boolean;
  phoneNumber?: string;
  organization?: string;
}

export interface Investment {
  id: string;
  userId: string;
  poolId: string;
  poolName: string;
  amount: number;
  apy: number;
  status: 'pending' | 'active' | 'completed' | 'defaulted';
  investedAt: string;
  maturesAt?: string;
  expectedReturn: number;
  currentReturn: number;
  txHash?: string;
  receiptHash?: string;
}

export interface Pool {
  id: string;
  name: string;
  description: string;
  category: 'Agriculture' | 'Retail' | 'Health & Wellness' | 'Crafts & Heritage' | 'Manufacturing';
  apy: { min: number; max: number };
  duration: { min: number; max: number };
  minInvestment: number;
  tvl: number;
  available: boolean;
  comingSoon?: boolean;
  fundingProgress: number;
  fundingTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  imageUrl?: string;
  shariaCompliant: boolean;
  createdAt: string;
  roiHistory: { date: string; value: number }[];
  usdcTreasury: string; // USDC token account to receive investments
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  businessName: string;
  vendorId?: string;
  vendorName?: string;
  amount: number;
  status: 'draft' | 'submitted' | 'verifying' | 'funded' | 'in_progress' | 'fulfilled' | 'repaid' | 'rejected';
  items: { name: string; quantity: number; unitPrice: number }[];
  createdAt: string;
  fundedAt?: string;
  expectedFulfillment?: string;
  actualFulfillment?: string;
  repaymentDue?: string;
  repaidAt?: string;
  cooperativeVerified?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'invest' | 'repayment' | 'withdraw' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  description: string;
  relatedPoolId?: string;
  relatedInvestmentId?: string;
  txHash?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface ImpactMetrics {
  msmeSupported: number;
  totalDisbursed: number;
  jobsCreated: number;
  communitiesImpacted: number;
  countries: number;
  womenLedBusinesses: number;
  ruralBusinesses: number;
  averageROI: number;
}

export interface VendorService {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  active: boolean;
  rating: number;
  ordersFulfilled: number;
}

export interface Partnership {
  id: string;
  vendorId: string;
  vendorName: string;
  cooperativeId: string;
  cooperativeName: string;
  status: 'active' | 'pending' | 'paused' | 'ended';
  startedAt: string;
  totalValue: number;
  performanceRating: number;
  services: string[];
}

export interface ComplianceDocument {
  id: string;
  userId: string;
  documentType: string;
  fileName: string;
  status: 'pending' | 'verified' | 'rejected';
  uploadedAt: string;
  expiresAt?: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string;
  businessType: string;
  registrationNumber: string;
  foundedYear: number;
  employees: number;
  annualRevenue: number;
  description: string;
  location: string;
  tawfScore: number;
  verifiedBy: string[];
  linkedCooperatives: string[];
}

export interface SystemAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  type: 'system' | 'compliance' | 'security' | 'business';
  resolved: boolean;
  createdAt: string;
}

// ============================================================================
// MOCK USERS
// ============================================================================

export const mockUsers: User[] = [
  // Investors
  {
    id: 'inv-1',
    name: 'Ahmad Rahman',
    email: 'ahmad.rahman@example.com',
    role: 'investor',
    avatar: '',
    status: 'active',
    joinedAt: '2024-01-15T00:00:00Z',
    tier: 'gold',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    kycVerified: true,
    phoneNumber: '+6281234567890',
  },
  {
    id: 'inv-2',
    name: 'Siti Nurhaliza',
    email: 'siti.nur@example.com',
    role: 'investor',
    avatar: '',
    status: 'active',
    joinedAt: '2024-02-20T00:00:00Z',
    tier: 'silver',
    walletAddress: '9h1Y7M7pJFQnHcLiSGYKZJ3PVPLNbYbGykxJgQKPXqVz',
    kycVerified: true,
    phoneNumber: '+6282345678901',
  },
  {
    id: 'inv-3',
    name: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    role: 'investor',
    avatar: '',
    status: 'active',
    joinedAt: '2024-03-10T00:00:00Z',
    tier: 'bronze',
    walletAddress: '3HCyVKzPRgDfgWzE1j2tKcAqNnfNW4P6qKq4VqB9bNqm',
    kycVerified: true,
    phoneNumber: '+6283456789012',
  },
  // Vendors
  {
    id: 'ven-1',
    name: 'PT Indonesia Teknologi',
    email: 'contact@indonesiatek.co.id',
    role: 'vendor',
    avatar: '',
    status: 'active',
    joinedAt: '2023-11-05T00:00:00Z',
    tier: 'platinum',
    kycVerified: true,
    organization: 'PT Indonesia Teknologi',
    phoneNumber: '+622112345678',
  },
  {
    id: 'ven-2',
    name: 'CV Sukses Jaya',
    email: 'info@suksesjaya.com',
    role: 'vendor',
    avatar: '',
    status: 'active',
    joinedAt: '2024-01-20T00:00:00Z',
    tier: 'gold',
    kycVerified: true,
    organization: 'CV Sukses Jaya',
    phoneNumber: '+622123456789',
  },
  // Cooperatives
  {
    id: 'coop-1',
    name: 'BMT Berkat',
    email: 'info@bmtberkat.co.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2023-08-15T00:00:00Z',
    tier: 'platinum',
    kycVerified: true,
    organization: 'BMT Berkat',
    phoneNumber: '+62741234567',
  },
  {
    id: 'coop-2',
    name: 'Koperasi Sejahtera',
    email: 'admin@koperasisejahtera.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2023-10-01T00:00:00Z',
    tier: 'gold',
    kycVerified: true,
    organization: 'Koperasi Sejahtera',
    phoneNumber: '+62762345678',
  },
  {
    id: 'coop-3',
    name: 'BMT Umat',
    email: 'contact@bmtumat.co.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2024-01-10T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'BMT Umat',
    phoneNumber: '+62753456789',
  },
  // Business Owners
  {
    id: 'bus-1',
    name: 'Warung Berkah',
    email: 'warungberkah@example.com',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2023-12-01T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'Warung Berkah',
    phoneNumber: '+6284567890123',
  },
  {
    id: 'bus-2',
    name: 'Jamu Herbal Sehat',
    email: 'jamuherbal@example.com',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-02-15T00:00:00Z',
    tier: 'bronze',
    kycVerified: true,
    organization: 'Jamu Herbal Sehat',
    phoneNumber: '+6285678901234',
  },
  {
    id: 'bus-3',
    name: 'Tani Makmur',
    email: 'tanimakmur@example.com',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-03-01T00:00:00Z',
    tier: 'bronze',
    kycVerified: false,
    organization: 'Tani Makmur',
    phoneNumber: '+6286789012345',
  },
  {
    id: 'bus-4',
    name: 'Kerajinan Nusantara',
    email: 'kerajinan@example.com',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-02-01T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'Kerajinan Nusantara',
    phoneNumber: '+6287890123456',
  },
  // Admin
  {
    id: 'admin-1',
    name: 'Tawf Admin',
    email: 'admin@tawf.finance',
    role: 'admin',
    avatar: '',
    status: 'active',
    joinedAt: '2023-01-01T00:00:00Z',
    kycVerified: true,
    organization: 'Tawf Finance',
    phoneNumber: '+622198765432',
  },
];

// Demo users for login
export const demoUsers = {
  investor: mockUsers[0],
  vendor: mockUsers[3],
  cooperative: mockUsers[5],
  business: mockUsers[8],
  admin: mockUsers[12],
};

// ============================================================================
// MOCK POOLS
// ============================================================================

export const mockPools: Pool[] = [
  {
    id: 'kurban-farms',
    name: 'Kurban Farms Pool',
    description: 'Support livestock farmers with ethical financing for cattle, goats, and sheep. Earn returns from seasonal demand cycles.',
    category: 'Agriculture',
    apy: { min: 12, max: 18 },
    duration: { min: 30, max: 60 },
    minInvestment: 10,
    tvl: 125000,
    available: true,
    fundingProgress: 125000,
    fundingTarget: 150000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-01-01T00:00:00Z',
    roiHistory: [
      { date: '2024-01', value: 12.5 },
      { date: '2024-02', value: 14.2 },
      { date: '2024-03', value: 15.8 },
      { date: '2024-04', value: 16.5 },
      { date: '2024-05', value: 17.2 },
      { date: '2024-06', value: 18.0 },
    ],
    usdcTreasury: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  },
  {
    id: 'warung',
    name: 'Warung Pool',
    description: 'Fund neighborhood convenience stores (warungs) across Indonesia. Help small retailers restock inventory and grow their business.',
    category: 'Retail',
    apy: { min: 10, max: 15 },
    duration: { min: 30, max: 45 },
    minInvestment: 10,
    tvl: 89000,
    available: false,
    comingSoon: true,
    fundingProgress: 89000,
    fundingTarget: 100000,
    riskLevel: 'low',
    shariaCompliant: true,
    createdAt: '2024-01-15T00:00:00Z',
    roiHistory: [
      { date: '2024-01', value: 10.2 },
      { date: '2024-02', value: 11.5 },
      { date: '2024-03', value: 12.8 },
      { date: '2024-04', value: 13.2 },
      { date: '2024-05', value: 14.0 },
      { date: '2024-06', value: 15.0 },
    ],
    usdcTreasury: '9h1Y7M7pJFQnHcLiSGYKZJ3PVPLNbYbGykxJgQKPXqVz',
  },
  {
    id: 'jamu-herbal',
    name: 'Jamu & Herbal Pool',
    description: 'Finance traditional herbal medicine producers. Support Indonesia\'s natural wellness industry while earning steady yields.',
    category: 'Health & Wellness',
    apy: { min: 14, max: 20 },
    duration: { min: 45, max: 90 },
    minInvestment: 25,
    tvl: 67000,
    available: false,
    comingSoon: true,
    fundingProgress: 67000,
    fundingTarget: 80000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-02-01T00:00:00Z',
    roiHistory: [
      { date: '2024-02', value: 14.5 },
      { date: '2024-03', value: 16.2 },
      { date: '2024-04', value: 17.8 },
      { date: '2024-05', value: 18.5 },
      { date: '2024-06', value: 19.5 },
    ],
    usdcTreasury: '3HCyVKzPRgDfgWzE1j2tKcAqNnfNW4P6qKq4VqB9bNqm',
  },
  {
    id: 'organic-food',
    name: 'Organic Food Pool',
    description: 'Back organic farmers and sustainable food producers. Your investment supports chemical-free agriculture and healthy food access.',
    category: 'Agriculture',
    apy: { min: 10, max: 16 },
    duration: { min: 60, max: 90 },
    minInvestment: 15,
    tvl: 45000,
    available: false,
    comingSoon: true,
    fundingProgress: 45000,
    fundingTarget: 60000,
    riskLevel: 'low',
    shariaCompliant: true,
    createdAt: '2024-02-15T00:00:00Z',
    roiHistory: [
      { date: '2024-02', value: 10.5 },
      { date: '2024-03', value: 12.0 },
      { date: '2024-04', value: 13.5 },
      { date: '2024-05', value: 14.8 },
      { date: '2024-06', value: 16.0 },
    ],
    usdcTreasury: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tpr',
  },
  {
    id: 'artisan-goods',
    name: 'Artisan Goods Pool',
    description: 'Fund traditional craftsmen and women creating batik, pottery, woodwork, and other cultural heritage products.',
    category: 'Crafts & Heritage',
    apy: { min: 12, max: 17 },
    duration: { min: 45, max: 75 },
    minInvestment: 20,
    tvl: 38000,
    available: false,
    comingSoon: true,
    fundingProgress: 38000,
    fundingTarget: 50000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-03-01T00:00:00Z',
    roiHistory: [
      { date: '2024-03', value: 12.0 },
      { date: '2024-04', value: 13.5 },
      { date: '2024-05', value: 15.0 },
      { date: '2024-06', value: 16.5 },
    ],
    usdcTreasury: '2nL2iTqkPjHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVV',
  },
  {
    id: 'manufacturing-sme',
    name: 'SME Manufacturing Pool',
    description: 'Support small manufacturing businesses producing furniture, textiles, and household goods for local and regional markets.',
    category: 'Manufacturing',
    apy: { min: 11, max: 16 },
    duration: { min: 60, max: 90 },
    minInvestment: 50,
    tvl: 95000,
    available: false,
    comingSoon: true,
    fundingProgress: 95000,
    fundingTarget: 120000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-01-20T00:00:00Z',
    roiHistory: [
      { date: '2024-01', value: 11.0 },
      { date: '2024-02', value: 12.5 },
      { date: '2024-03', value: 13.8 },
      { date: '2024-04', value: 14.5 },
      { date: '2024-05', value: 15.2 },
      { date: '2024-06', value: 16.0 },
    ],
    usdcTreasury: '4kL3jTrPkHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVE',
  },
];

// ============================================================================
// MOCK INVESTMENTS
// ============================================================================

export const mockInvestments: Investment[] = [
  {
    id: 'inv-001',
    userId: 'inv-1',
    poolId: 'kurban-farms',
    poolName: 'Kurban Farms Pool',
    amount: 500,
    apy: 15,
    status: 'active',
    investedAt: '2024-03-01T00:00:00Z',
    maturesAt: '2024-05-01T00:00:00Z',
    expectedReturn: 75,
    currentReturn: 45,
    txHash: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprVSpra1HKbbEJPHy4EQqpoLwghV4bVw3kYHcCYLwEEMdF',
    receiptHash: 'GjJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXTz',
  },
  {
    id: 'inv-002',
    userId: 'inv-1',
    poolId: 'warung',
    poolName: 'Warung Pool',
    amount: 300,
    apy: 12,
    status: 'active',
    investedAt: '2024-03-15T00:00:00Z',
    maturesAt: '2024-04-30T00:00:00Z',
    expectedReturn: 36,
    currentReturn: 28,
    txHash: '2nL2iTqkPjHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ4',
    receiptHash: 'DrJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXT2',
  },
  {
    id: 'inv-003',
    userId: 'inv-1',
    poolId: 'jamu-herbal',
    poolName: 'Jamu & Herbal Pool',
    amount: 250,
    apy: 18,
    status: 'completed',
    investedAt: '2024-01-10T00:00:00Z',
    maturesAt: '2024-03-10T00:00:00Z',
    expectedReturn: 45,
    currentReturn: 45,
    txHash: '4kL3jTrPkHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ5',
    receiptHash: 'HrJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXT3',
  },
  {
    id: 'inv-004',
    userId: 'inv-2',
    poolId: 'organic-food',
    poolName: 'Organic Food Pool',
    amount: 200,
    apy: 14,
    status: 'active',
    investedAt: '2024-03-20T00:00:00Z',
    maturesAt: '2024-05-20T00:00:00Z',
    expectedReturn: 28,
    currentReturn: 12,
    txHash: '3mL4kUsQlHcK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ6',
  },
  {
    id: 'inv-005',
    userId: 'inv-2',
    poolId: 'artisan-goods',
    poolName: 'Artisan Goods Pool',
    amount: 150,
    apy: 15,
    status: 'active',
    investedAt: '2024-02-15T00:00:00Z',
    maturesAt: '2024-04-15T00:00:00Z',
    expectedReturn: 22.5,
    currentReturn: 20,
  },
  {
    id: 'inv-006',
    userId: 'inv-3',
    poolId: 'warung',
    poolName: 'Warung Pool',
    amount: 100,
    apy: 11,
    status: 'active',
    investedAt: '2024-03-25T00:00:00Z',
    maturesAt: '2024-04-25T00:00:00Z',
    expectedReturn: 11,
    currentReturn: 5,
  },
];

// ============================================================================
// MOCK PURCHASE ORDERS
// ============================================================================

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    businessId: 'bus-1',
    businessName: 'Warung Berkah',
    vendorId: 'ven-1',
    vendorName: 'PT Indonesia Teknologi',
    amount: 5000,
    status: 'funded',
    items: [
      { name: 'Point of Sale System', quantity: 1, unitPrice: 3000 },
      { name: 'Inventory Management Software', quantity: 1, unitPrice: 2000 },
    ],
    createdAt: '2024-03-01T00:00:00Z',
    fundedAt: '2024-03-05T00:00:00Z',
    expectedFulfillment: '2024-03-20T00:00:00Z',
    repaymentDue: '2024-05-05T00:00:00Z',
    cooperativeVerified: true,
  },
  {
    id: 'po-002',
    businessId: 'bus-2',
    businessName: 'Jamu Herbal Sehat',
    vendorId: 'ven-2',
    vendorName: 'CV Sukses Jaya',
    amount: 3500,
    status: 'in_progress',
    items: [
      { name: 'Packaging Materials', quantity: 500, unitPrice: 5 },
      { name: 'Label Printer', quantity: 1, unitPrice: 1000 },
    ],
    createdAt: '2024-03-10T00:00:00Z',
    fundedAt: '2024-03-12T00:00:00Z',
    expectedFulfillment: '2024-03-25T00:00:00Z',
    repaymentDue: '2024-05-12T00:00:00Z',
    cooperativeVerified: true,
  },
  {
    id: 'po-003',
    businessId: 'bus-1',
    businessName: 'Warung Berkah',
    amount: 8000,
    status: 'verifying',
    items: [
      { name: 'Refrigeration Unit', quantity: 2, unitPrice: 4000 },
    ],
    createdAt: '2024-03-25T00:00:00Z',
    cooperativeVerified: false,
  },
  {
    id: 'po-004',
    businessId: 'bus-4',
    businessName: 'Kerajinan Nusantara',
    vendorId: 'ven-1',
    vendorName: 'PT Indonesia Teknologi',
    amount: 4500,
    status: 'repaid',
    items: [
      { name: 'Raw Materials - Batik', quantity: 100, unitPrice: 25 },
      { name: 'Dyes (Natural)', quantity: 50, unitPrice: 40 },
    ],
    createdAt: '2024-01-15T00:00:00Z',
    fundedAt: '2024-01-18T00:00:00Z',
    expectedFulfillment: '2024-02-01T00:00:00Z',
    actualFulfillment: '2024-02-01T00:00:00Z',
    repaymentDue: '2024-03-18T00:00:00Z',
    repaidAt: '2024-03-18T00:00:00Z',
    cooperativeVerified: true,
  },
  {
    id: 'po-005',
    businessId: 'bus-3',
    businessName: 'Tani Makmur',
    amount: 6000,
    status: 'draft',
    items: [
      { name: 'Fertilizer (Organic)', quantity: 200, unitPrice: 15 },
      { name: 'Seeds (Various)', quantity: 50, unitPrice: 60 },
    ],
    createdAt: '2024-03-28T00:00:00Z',
  },
];

// ============================================================================
// MOCK TRANSACTIONS
// ============================================================================

export const mockTransactions: Transaction[] = [
  {
    id: 'tx-001',
    userId: 'inv-1',
    type: 'invest',
    amount: 500,
    status: 'completed',
    createdAt: '2024-03-01T10:30:00Z',
    description: 'Investment in Kurban Farms Pool',
    relatedPoolId: 'kurban-farms',
    relatedInvestmentId: 'inv-001',
    txHash: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprVSpra1HKbbEJPHy4EQqpoLwghV4bVw3kYHcCYLwEEMdF',
  },
  {
    id: 'tx-002',
    userId: 'inv-1',
    type: 'invest',
    amount: 300,
    status: 'completed',
    createdAt: '2024-03-15T14:20:00Z',
    description: 'Investment in Warung Pool',
    relatedPoolId: 'warung',
    relatedInvestmentId: 'inv-002',
    txHash: '2nL2iTqkPjHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ4',
  },
  {
    id: 'tx-003',
    userId: 'inv-1',
    type: 'repayment',
    amount: 45,
    status: 'completed',
    createdAt: '2024-03-10T09:00:00Z',
    description: 'Return from Jamu & Herbal Pool',
    relatedPoolId: 'jamu-herbal',
    relatedInvestmentId: 'inv-003',
  },
  {
    id: 'tx-004',
    userId: 'inv-1',
    type: 'deposit',
    amount: 1000,
    status: 'completed',
    createdAt: '2024-02-28T16:45:00Z',
    description: 'Wallet deposit via Phantom',
    txHash: 'EzJa6Cg5LhCLeGFs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ7',
  },
  {
    id: 'tx-005',
    userId: 'inv-2',
    type: 'invest',
    amount: 200,
    status: 'completed',
    createdAt: '2024-03-20T11:15:00Z',
    description: 'Investment in Organic Food Pool',
    relatedPoolId: 'organic-food',
    relatedInvestmentId: 'inv-004',
  },
  {
    id: 'tx-006',
    userId: 'bus-1',
    type: 'invest',
    amount: 5000,
    status: 'completed',
    createdAt: '2024-03-05T08:00:00Z',
    description: 'Funding for PO-001',
    relatedPoolId: 'warung',
    txHash: 'FzKb7Dh6MiDmfHGs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ8',
  },
];

// ============================================================================
// MOCK NOTIFICATIONS
// ============================================================================

export const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    userId: 'inv-1',
    title: 'Investment Return Received',
    message: 'You received $45 return from Jamu & Herbal Pool investment.',
    type: 'success',
    read: false,
    createdAt: '2024-03-28T10:30:00Z',
    actionUrl: '/investor/portfolio',
  },
  {
    id: 'notif-002',
    userId: 'inv-1',
    title: 'New Pool Available',
    message: 'Manufacturing SME Pool is now open for investment with 11-16% APY.',
    type: 'info',
    read: false,
    createdAt: '2024-03-27T14:20:00Z',
    actionUrl: '/investor/pools',
  },
  {
    id: 'notif-003',
    userId: 'inv-1',
    title: 'Investment Maturity Reminder',
    message: 'Your Warung Pool investment will mature in 5 days.',
    type: 'warning',
    read: true,
    createdAt: '2024-03-25T09:00:00Z',
    actionUrl: '/investor/portfolio',
  },
  {
    id: 'notif-004',
    userId: 'coop-1',
    title: 'New PO Verification Request',
    message: 'Warung Berkah submitted a new PO for verification.',
    type: 'info',
    read: false,
    createdAt: '2024-03-28T11:00:00Z',
    actionUrl: '/cooperative/verification',
  },
  {
    id: 'notif-005',
    userId: 'bus-1',
    title: 'PO Approved',
    message: 'Your purchase order PO-001 has been funded.',
    type: 'success',
    read: false,
    createdAt: '2024-03-05T08:00:00Z',
    actionUrl: '/business/purchase-orders',
  },
];

// ============================================================================
// MOCK IMPACT METRICS
// ============================================================================

export const mockImpactMetrics: ImpactMetrics = {
  msmeSupported: 2450,
  totalDisbursed: 8750000,
  jobsCreated: 12450,
  communitiesImpacted: 850,
  countries: 3,
  womenLedBusinesses: 980,
  ruralBusinesses: 1650,
  averageROI: 14.5,
};

// ============================================================================
// MOCK VENDOR SERVICES
// ============================================================================

export const mockVendorServices: VendorService[] = [
  {
    id: 'srv-001',
    vendorId: 'ven-1',
    name: 'POS System Installation',
    category: 'Technology',
    description: 'Complete point of sale system with inventory management',
    price: 3000,
    unit: 'system',
    active: true,
    rating: 4.8,
    ordersFulfilled: 156,
  },
  {
    id: 'srv-002',
    vendorId: 'ven-1',
    name: 'Inventory Management Software',
    category: 'Software',
    description: 'Cloud-based inventory tracking and management',
    price: 2000,
    unit: 'license',
    active: true,
    rating: 4.7,
    ordersFulfilled: 203,
  },
  {
    id: 'srv-003',
    vendorId: 'ven-1',
    name: 'Technical Support Package',
    category: 'Service',
    description: 'Monthly technical support and maintenance',
    price: 500,
    unit: 'month',
    active: true,
    rating: 4.9,
    ordersFulfilled: 89,
  },
  {
    id: 'srv-004',
    vendorId: 'ven-2',
    name: 'Packaging Materials',
    category: 'Supplies',
    description: 'Eco-friendly packaging for food products',
    price: 5,
    unit: 'unit',
    active: true,
    rating: 4.5,
    ordersFulfilled: 1240,
  },
  {
    id: 'srv-005',
    vendorId: 'ven-2',
    name: 'Label Printing Service',
    category: 'Service',
    description: 'Custom product label printing',
    price: 1000,
    unit: 'batch',
    active: true,
    rating: 4.6,
    ordersFulfilled: 345,
  },
];

// ============================================================================
// MOCK PARTNERSHIPS
// ============================================================================

export const mockPartnerships: Partnership[] = [
  {
    id: 'prt-001',
    vendorId: 'ven-1',
    vendorName: 'PT Indonesia Teknologi',
    cooperativeId: 'coop-1',
    cooperativeName: 'BMT Berkat',
    status: 'active',
    startedAt: '2023-11-05T00:00:00Z',
    totalValue: 125000,
    performanceRating: 4.8,
    services: ['POS Systems', 'Software Solutions', 'Technical Support'],
  },
  {
    id: 'prt-002',
    vendorId: 'ven-2',
    vendorName: 'CV Sukses Jaya',
    cooperativeId: 'coop-1',
    cooperativeName: 'BMT Berkat',
    status: 'active',
    startedAt: '2024-01-20T00:00:00Z',
    totalValue: 67500,
    performanceRating: 4.6,
    services: ['Packaging Materials', 'Label Printing'],
  },
  {
    id: 'prt-003',
    vendorId: 'ven-1',
    vendorName: 'PT Indonesia Teknologi',
    cooperativeId: 'coop-2',
    cooperativeName: 'Koperasi Sejahtera',
    status: 'active',
    startedAt: '2024-02-01T00:00:00Z',
    totalValue: 45000,
    performanceRating: 4.7,
    services: ['POS Systems', 'Software Solutions'],
  },
];

// ============================================================================
// MOCK COMPLIANCE DOCUMENTS
// ============================================================================

export const mockComplianceDocuments: ComplianceDocument[] = [
  {
    id: 'doc-001',
    userId: 'ven-1',
    documentType: 'Business License',
    fileName: 'SIUP_pt-indonesia-tek.pdf',
    status: 'verified',
    uploadedAt: '2023-11-05T00:00:00Z',
    expiresAt: '2025-11-05T00:00:00Z',
  },
  {
    id: 'doc-002',
    userId: 'ven-1',
    documentType: 'Tax ID',
    fileName: 'NPWP_pt-indonesia-tek.pdf',
    status: 'verified',
    uploadedAt: '2023-11-05T00:00:00Z',
  },
  {
    id: 'doc-003',
    userId: 'bus-1',
    documentType: 'Business Registration',
    fileName: 'NIB_warung-berkah.pdf',
    status: 'verified',
    uploadedAt: '2023-12-01T00:00:00Z',
  },
  {
    id: 'doc-004',
    userId: 'bus-1',
    documentType: 'Identity Document',
    fileName: 'KTP_ahmad-rahman.pdf',
    status: 'verified',
    uploadedAt: '2023-12-01T00:00:00Z',
  },
  {
    id: 'doc-005',
    userId: 'bus-3',
    documentType: 'Business Registration',
    fileName: 'NIB_tani-makmur.pdf',
    status: 'pending',
    uploadedAt: '2024-03-01T00:00:00Z',
  },
];

// ============================================================================
// MOCK BUSINESS PROFILES
// ============================================================================

export const mockBusinessProfiles: BusinessProfile[] = [
  {
    id: 'prof-001',
    userId: 'bus-1',
    businessName: 'Warung Berkah',
    businessType: 'Retail',
    registrationNumber: 'NIB-1234567890',
    foundedYear: 2019,
    employees: 4,
    annualRevenue: 85000,
    description: 'Neighborhood convenience store serving the local community with daily essentials.',
    location: 'Jakarta Selatan, DKI Jakarta',
    tawfScore: 78,
    verifiedBy: ['coop-1'],
    linkedCooperatives: ['coop-1'],
  },
  {
    id: 'prof-002',
    userId: 'bus-2',
    businessName: 'Jamu Herbal Sehat',
    businessType: 'Health & Wellness',
    registrationNumber: 'NIB-0987654321',
    foundedYear: 2021,
    employees: 8,
    annualRevenue: 120000,
    description: 'Traditional herbal medicine producer using natural ingredients and family recipes.',
    location: 'Yogyakarta, DIY',
    tawfScore: 82,
    verifiedBy: ['coop-1'],
    linkedCooperatives: ['coop-1'],
  },
  {
    id: 'prof-003',
    userId: 'bus-3',
    businessName: 'Tani Makmur',
    businessType: 'Agriculture',
    registrationNumber: 'NIB-1122334455',
    foundedYear: 2020,
    employees: 6,
    annualRevenue: 65000,
    description: 'Organic farm producing vegetables and herbs for local markets.',
    location: 'Bandung, West Java',
    tawfScore: 71,
    verifiedBy: [],
    linkedCooperatives: ['coop-2'],
  },
  {
    id: 'prof-004',
    userId: 'bus-4',
    businessName: 'Kerajinan Nusantara',
    businessType: 'Crafts',
    registrationNumber: 'NIB-5544332211',
    foundedYear: 2018,
    employees: 12,
    annualRevenue: 150000,
    description: 'Traditional batik and handicraft producer preserving Indonesian cultural heritage.',
    location: 'Surakarta, Central Java',
    tawfScore: 85,
    verifiedBy: ['coop-1', 'coop-2'],
    linkedCooperatives: ['coop-1', 'coop-2'],
  },
];

// ============================================================================
// MOCK SYSTEM ALERTS
// ============================================================================

export const mockSystemAlerts: SystemAlert[] = [
  {
    id: 'alert-001',
    severity: 'medium',
    title: 'High Transaction Volume',
    message: 'Transaction volume is 50% higher than usual. Please monitor system performance.',
    type: 'system',
    resolved: false,
    createdAt: '2024-03-28T10:00:00Z',
  },
  {
    id: 'alert-002',
    severity: 'low',
    title: 'Pending KYC Approvals',
    message: 'There are 8 pending KYC approvals requiring attention.',
    type: 'compliance',
    resolved: false,
    createdAt: '2024-03-28T09:30:00Z',
  },
  {
    id: 'alert-003',
    severity: 'high',
    title: 'Unusual Login Activity',
    message: 'Multiple failed login attempts detected from IP 192.168.1.xxx',
    type: 'security',
    resolved: false,
    createdAt: '2024-03-27T22:15:00Z',
  },
  {
    id: 'alert-004',
    severity: 'low',
    title: 'Pool Near Capacity',
    message: 'Kurban Farms Pool is 85% funded. Consider opening new pool.',
    type: 'business',
    resolved: false,
    createdAt: '2024-03-27T16:45:00Z',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getUserById(id: string): User | undefined {
  return mockUsers.find(u => u.id === id);
}

export function getUsersByRole(role: UserRole): User[] {
  return mockUsers.filter(u => u.role === role);
}

export function getInvestmentsByUserId(userId: string): Investment[] {
  return mockInvestments.filter(i => i.userId === userId);
}

export function getPurchaseOrdersByBusinessId(businessId: string): PurchaseOrder[] {
  return mockPurchaseOrders.filter(po => po.businessId === businessId);
}

export function getPurchaseOrdersByCooperative(): PurchaseOrder[] {
  // In a real system, this would check which cooperative is assigned
  return mockPurchaseOrders.filter(po => po.status === 'verifying' || po.status === 'funded');
}

export function getTransactionsByUserId(userId: string): Transaction[] {
  return mockTransactions.filter(t => t.userId === userId);
}

export function getNotificationsByUserId(userId: string): Notification[] {
  return mockNotifications.filter(n => n.userId === userId);
}

export function getPoolById(id: string): Pool | undefined {
  return mockPools.find(p => p.id === id);
}

export function getVendorServicesByVendorId(vendorId: string): VendorService[] {
  return mockVendorServices.filter(s => s.vendorId === vendorId);
}

export function getPartnershipsByVendorId(vendorId: string): Partnership[] {
  return mockPartnerships.filter(p => p.vendorId === vendorId);
}

export function getPartnershipsByCooperativeId(cooperativeId: string): Partnership[] {
  return mockPartnerships.filter(p => p.cooperativeId === cooperativeId);
}

export function getComplianceDocumentsByUserId(userId: string): ComplianceDocument[] {
  return mockComplianceDocuments.filter(d => d.userId === userId);
}

export function getBusinessProfileByUserId(userId: string): BusinessProfile | undefined {
  return mockBusinessProfiles.find(b => b.userId === userId);
}

// Format currency
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format date
export function formatDate(dateString: string, format: 'short' | 'long' = 'short'): string {
  const date = new Date(dateString);
  if (format === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Calculate days remaining
export function daysRemaining(dateString: string): number {
  const date = new Date(dateString);
  const today = new Date();
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Get status badge color
export function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
    active: { bg: 'bg-green-50', text: 'text-green-700' },
    completed: { bg: 'bg-blue-50', text: 'text-blue-700' },
    defaulted: { bg: 'bg-red-50', text: 'text-red-700' },
    draft: { bg: 'bg-gray-50', text: 'text-gray-700' },
    submitted: { bg: 'bg-blue-50', text: 'text-blue-700' },
    verifying: { bg: 'bg-purple-50', text: 'text-purple-700' },
    funded: { bg: 'bg-green-50', text: 'text-green-700' },
    in_progress: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    fulfilled: { bg: 'bg-teal-50', text: 'text-teal-700' },
    repaid: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700' },
    suspended: { bg: 'bg-red-50', text: 'text-red-700' },
    verified: { bg: 'bg-green-50', text: 'text-green-700' },
  };
  return colors[status] || { bg: 'bg-gray-50', text: 'text-gray-700' };
}
