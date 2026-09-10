// Mock Data Layer for Tawf Finance Prototype
// Comprehensive mock data for all user types and dashboard scenarios

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 'investor' | 'business' | 'cooperative' | 'issuer' | 'admin';

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
  fundingProgress: number;
  fundingTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  imageUrl?: string;
  shariaCompliant: boolean;
  createdAt: string;
  roiHistory: { date: string; value: number }[];
  usdcTreasury: string; // USDC token account to receive investments
  instrumentId?: string; // links to the Islamic finance instrument in instrumentCatalog
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
  // Licensed Issuers (Sekuritas)
  {
    id: 'iss-1',
    name: 'PT Sekuritas Indonesia',
    email: 'issuer@sekuritas.tawf.finance',
    role: 'issuer',
    avatar: '',
    status: 'active',
    joinedAt: '2023-11-05T00:00:00Z',
    tier: 'platinum',
    kycVerified: true,
    organization: 'PT Sekuritas Indonesia',
    phoneNumber: '+622112345678',
  },
  {
    id: 'iss-2',
    name: 'Sekuritas Nusantara',
    email: 'ops@sekuritasnusantara.co.id',
    role: 'issuer',
    avatar: '',
    status: 'active',
    joinedAt: '2024-01-20T00:00:00Z',
    tier: 'gold',
    kycVerified: true,
    organization: 'Sekuritas Nusantara',
    phoneNumber: '+622123456789',
  },
  // BPRS Originators (role kept as 'cooperative' for routing/state compatibility; displayed as "BPRS Originator")
  {
    id: 'coop-1',
    name: 'BPRS Amanah Ummah',
    email: 'info@bprsamanahummah.co.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2023-08-15T00:00:00Z',
    tier: 'platinum',
    kycVerified: true,
    organization: 'BPRS Amanah Ummah',
    phoneNumber: '+62741234567',
  },
  {
    id: 'coop-2',
    name: 'BPRS Barokah Sejahtera',
    email: 'admin@bprsbarokah.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2023-10-01T00:00:00Z',
    tier: 'gold',
    kycVerified: true,
    organization: 'BPRS Barokah Sejahtera',
    phoneNumber: '+62762345678',
  },
  {
    id: 'coop-3',
    name: 'BPRS Insan Cita',
    email: 'contact@bprsinsancita.co.id',
    role: 'cooperative',
    avatar: '',
    status: 'active',
    joinedAt: '2024-01-10T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'BPRS Insan Cita',
    phoneNumber: '+62753456789',
  },
  // Financing Segments (role kept as 'business'; represents a BPRS financing branch/segment)
  {
    id: 'bus-1',
    name: 'Micro-Trade Financing Segment',
    email: 'microtrade@bprsamanahummah.co.id',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2023-12-01T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'BPRS Amanah Ummah',
    phoneNumber: '+6284567890123',
  },
  {
    id: 'bus-2',
    name: 'Consumer Financing Segment',
    email: 'consumer@bprsbarokah.id',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-02-15T00:00:00Z',
    tier: 'bronze',
    kycVerified: true,
    organization: 'BPRS Barokah Sejahtera',
    phoneNumber: '+6285678901234',
  },
  {
    id: 'bus-3',
    name: 'Agri Financing Segment',
    email: 'agri@bprsinsancita.co.id',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-03-01T00:00:00Z',
    tier: 'bronze',
    kycVerified: false,
    organization: 'BPRS Insan Cita',
    phoneNumber: '+6286789012345',
  },
  {
    id: 'bus-4',
    name: 'SME Financing Segment',
    email: 'sme@bprsamanahummah.co.id',
    role: 'business',
    avatar: '',
    status: 'active',
    joinedAt: '2024-02-01T00:00:00Z',
    tier: 'silver',
    kycVerified: true,
    organization: 'BPRS Amanah Ummah',
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
  issuer: mockUsers[3],
  cooperative: mockUsers[5],
  business: mockUsers[8],
  admin: mockUsers[12],
};

// ============================================================================
// ISLAMIC FINANCE INSTRUMENT CATALOG
// ============================================================================
// Tawf is the all-in-one tokenization infrastructure for BPRS. Every akad a
// BPRS originates can be represented, structured, and settled on the same
// primitive. Status is honest about what is live today versus on the roadmap.

export type AkadFamily = 'Debt-based' | 'Equity-based' | 'Social' | 'Tradable';
export type InstrumentStatus = 'Live' | 'Structured' | 'Pipeline' | 'Roadmap';

export interface Instrument {
  id: string;
  name: string;
  arabic: string;
  family: AkadFamily;
  status: InstrumentStatus;
  summary: string;       // plain-English role
  useCase: string;       // typical BPRS use
  yieldBand: string;     // display band, no em-dash
  dsnRef: string;        // DSN-MUI fatwa reference (verified against DSN-MUI fatwa register)
}

// Yield bands per family: debt-like 5 to 9 percent, equity-like 7 to 11
// percent, social (Qard) 0 percent. Sukuk profit tracks the underlying pool.
export const instrumentCatalog: Instrument[] = [
  {
    id: 'murabaha',
    name: 'Murabaha',
    arabic: 'مرابحة',
    family: 'Debt-based',
    status: 'Live',
    summary: 'Cost-plus trust sale. The bank first owns the asset, then resells it to the client at a disclosed markup on deferred terms, taking genuine ownership risk before the sale.',
    useCase: 'Working capital and trade or inventory financing for micro and small clients.',
    yieldBand: '5 to 9 percent',
    dsnRef: 'DSN-MUI No. 04/DSN-MUI/IV/2000',
  },
  {
    id: 'ijarah',
    name: 'Ijarah',
    arabic: 'إجارة',
    family: 'Debt-based',
    status: 'Structured',
    summary: 'Lease. The bank owns an asset and leases its usufruct to the client for a rental over a fixed term.',
    useCase: 'Equipment, vehicle, and property financing.',
    yieldBand: '5 to 9 percent',
    dsnRef: 'DSN-MUI No. 09/DSN-MUI/IV/2000',
  },
  {
    id: 'musyarakah',
    name: 'Musyarakah',
    arabic: 'مشاركة',
    family: 'Equity-based',
    status: 'Live',
    summary: 'Partnership. All parties contribute capital and genuinely share profit and loss by an agreed ratio. An equity-based, risk-sharing structure.',
    useCase: 'Joint financing and the financing sell-down pool structure.',
    yieldBand: '7 to 11 percent (variable)',
    dsnRef: 'DSN-MUI No. 08/DSN-MUI/IV/2000',
  },
  {
    id: 'mudarabah',
    name: 'Mudarabah',
    arabic: 'مضاربة',
    family: 'Equity-based',
    status: 'Structured',
    summary: 'Profit-sharing. One party funds, the other manages. Profit is shared, capital loss sits with the funder absent misconduct.',
    useCase: 'Investment mandates where the bank or client manages the venture.',
    yieldBand: '7 to 11 percent (variable)',
    dsnRef: 'DSN-MUI No. 07/DSN-MUI/IV/2000',
  },
  {
    id: 'wakalah-istithmar',
    name: 'Wakalah bil Istithmar',
    arabic: 'وكالة بالاستثمار',
    family: 'Equity-based',
    status: 'Live',
    summary: 'Investment agency. An agent invests the principal\'s capital on the principal\'s behalf for a fee. The core sell-down akad for an outside investor pool.',
    useCase: 'The core financing sell-down akad for an outside investor pool.',
    yieldBand: '7 to 11 percent (variable)',
    dsnRef: 'DSN-MUI No. 10/DSN-MUI/IV/2000 (Wakalah)',
  },
  {
    id: 'salam',
    name: 'Salam',
    arabic: 'سلم',
    family: 'Debt-based',
    status: 'Pipeline',
    summary: 'Advance purchase. Full payment now for a commodity delivered at a defined future date.',
    useCase: 'Agricultural pre-harvest financing.',
    yieldBand: '5 to 9 percent',
    dsnRef: 'DSN-MUI No. 05/DSN-MUI/IV/2000',
  },
  {
    id: 'istisna',
    name: "Istisna'",
    arabic: 'استصناع',
    family: 'Debt-based',
    status: 'Pipeline',
    summary: 'Manufacture to order. Financing for goods built or constructed to a specification, paid in stages.',
    useCase: 'Construction and made-to-order manufacturing financing.',
    yieldBand: '5 to 9 percent',
    dsnRef: 'DSN-MUI No. 06/DSN-MUI/IV/2000',
  },
  {
    id: 'qard-hasan',
    name: 'Qard Hasan',
    arabic: 'قرض حسن',
    family: 'Social',
    status: 'Roadmap',
    summary: 'Benevolent loan. Principal only, no return. A social instrument funded through the Baitul Maal side.',
    useCase: 'Hardship and social financing distributed through community channels.',
    yieldBand: '0 percent (social)',
    dsnRef: 'DSN-MUI No. 19/DSN-MUI/IV/2001',
  },
  {
    id: 'sukuk',
    name: 'Sukuk',
    arabic: 'صكوك',
    family: 'Tradable',
    status: 'Roadmap',
    summary: 'Tradable certificates representing undivided ownership in real assets. Tawf targets asset-backed (true-sale) sukuk, not asset-based structures that merely mimic a bond. The tier-2 product for BPRS above the issuance threshold.',
    useCase: 'Public offering for the few BPRS above the IDR 80bn core-capital threshold.',
    yieldBand: 'tracks the underlying pool',
    dsnRef: 'DSN-MUI No. 32/DSN-MUI/IX/2002',
  },
];

export function getInstrumentById(id: string): Instrument | undefined {
  return instrumentCatalog.find(i => i.id === id);
}

// ============================================================================
// MOCK POOLS
// ============================================================================

export const mockPools: Pool[] = [
  {
    id: 'kurban-farms',
    name: 'BPRS Barokah Agri Financing Pool',
    description: 'Economic exposure to a pool of seasonal agricultural financing originated and serviced by BPRS Barokah, under a musyarakah sell-down akad.',
    category: 'Agriculture',
    apy: { min: 7, max: 10 },
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
      { date: '2024-01', value: 7.2 },
      { date: '2024-02', value: 7.8 },
      { date: '2024-03', value: 8.4 },
      { date: '2024-04', value: 8.9 },
      { date: '2024-05', value: 9.4 },
      { date: '2024-06', value: 9.8 },
    ],
    usdcTreasury: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    instrumentId: 'musyarakah',
  },
  {
    id: 'warung',
    name: 'BPRS Amanah Micro-Trade Pool',
    description: 'Exposure to a pool of micro-trade working-capital financing serviced locally by BPRS Amanah Ummah, funded outside its own deposit market.',
    category: 'Retail',
    apy: { min: 6, max: 8 },
    duration: { min: 30, max: 45 },
    minInvestment: 10,
    tvl: 89000,
    available: true,
    fundingProgress: 89000,
    fundingTarget: 100000,
    riskLevel: 'low',
    shariaCompliant: true,
    createdAt: '2024-01-15T00:00:00Z',
    roiHistory: [
      { date: '2024-01', value: 6.2 },
      { date: '2024-02', value: 6.6 },
      { date: '2024-03', value: 7.0 },
      { date: '2024-04', value: 7.3 },
      { date: '2024-05', value: 7.6 },
      { date: '2024-06', value: 8.0 },
    ],
    usdcTreasury: '9h1Y7M7pJFQnHcLiSGYKZJ3PVPLNbYbGykxJgQKPXqVz',
    instrumentId: 'murabaha',
  },
  {
    id: 'jamu-herbal',
    name: 'BPRS Barokah Consumer Financing Pool',
    description: 'Exposure to a pool of Shariah consumer financing serviced by BPRS Barokah. Pool size, NPF ratio, and akad compliance are verifiable on-chain.',
    category: 'Health & Wellness',
    apy: { min: 6, max: 9 },
    duration: { min: 45, max: 90 },
    minInvestment: 25,
    tvl: 67000,
    available: true,
    fundingProgress: 67000,
    fundingTarget: 80000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-02-01T00:00:00Z',
    roiHistory: [
      { date: '2024-02', value: 6.5 },
      { date: '2024-03', value: 7.2 },
      { date: '2024-04', value: 7.8 },
      { date: '2024-05', value: 8.4 },
      { date: '2024-06', value: 9.0 },
    ],
    usdcTreasury: '3HCyVKzPRgDfgWzE1j2tKcAqNnfNW4P6qKq4VqB9bNqm',
    instrumentId: 'murabaha',
  },
  {
    id: 'organic-food',
    name: 'BPRS Insan Cita Agri Financing Pool',
    description: 'Exposure to a pool of organic-agriculture financing originated and serviced by BPRS Insan Cita, under a wakalah bil istithmar structure.',
    category: 'Agriculture',
    apy: { min: 7, max: 10 },
    duration: { min: 60, max: 90 },
    minInvestment: 15,
    tvl: 45000,
    available: true,
    fundingProgress: 45000,
    fundingTarget: 60000,
    riskLevel: 'low',
    shariaCompliant: true,
    createdAt: '2024-02-15T00:00:00Z',
    roiHistory: [
      { date: '2024-02', value: 7.2 },
      { date: '2024-03', value: 7.9 },
      { date: '2024-04', value: 8.6 },
      { date: '2024-05', value: 9.3 },
      { date: '2024-06', value: 10.0 },
    ],
    usdcTreasury: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tpr',
    instrumentId: 'wakalah-istithmar',
  },
  {
    id: 'artisan-goods',
    name: 'BPRS Barokah Trade Financing Pool',
    description: 'Exposure to a pool of small-trade financing (including craft and heritage producers) serviced by BPRS Barokah under a compliant sell-down akad.',
    category: 'Crafts & Heritage',
    apy: { min: 5, max: 8 },
    duration: { min: 45, max: 75 },
    minInvestment: 20,
    tvl: 38000,
    available: true,
    fundingProgress: 38000,
    fundingTarget: 50000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-03-01T00:00:00Z',
    roiHistory: [
      { date: '2024-03', value: 5.5 },
      { date: '2024-04', value: 6.2 },
      { date: '2024-05', value: 7.0 },
      { date: '2024-06', value: 7.8 },
    ],
    usdcTreasury: '2nL2iTqkPjHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVV',
    instrumentId: 'murabaha',
  },
  {
    id: 'manufacturing-sme',
    name: 'BPRS Amanah SME Financing Pool',
    description: 'Exposure to a pool of small-enterprise (manufacturing) financing serviced by BPRS Amanah Ummah, structured as a musyarakah sell-down.',
    category: 'Manufacturing',
    apy: { min: 8, max: 11 },
    duration: { min: 60, max: 90 },
    minInvestment: 50,
    tvl: 95000,
    available: true,
    fundingProgress: 95000,
    fundingTarget: 120000,
    riskLevel: 'medium',
    shariaCompliant: true,
    createdAt: '2024-01-20T00:00:00Z',
    roiHistory: [
      { date: '2024-01', value: 8.0 },
      { date: '2024-02', value: 8.6 },
      { date: '2024-03', value: 9.2 },
      { date: '2024-04', value: 9.8 },
      { date: '2024-05', value: 10.4 },
      { date: '2024-06', value: 11.0 },
    ],
    usdcTreasury: '4kL3jTrPkHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVE',
    instrumentId: 'musyarakah',
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
    poolName: 'BPRS Barokah Agri Financing Pool',
    amount: 500,
    apy: 9,
    status: 'active',
    investedAt: '2024-03-01T00:00:00Z',
    maturesAt: '2024-05-01T00:00:00Z',
    expectedReturn: 45,
    currentReturn: 27,
    txHash: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprVSpra1HKbbEJPHy4EQqpoLwghV4bVw3kYHcCYLwEEMdF',
    receiptHash: 'GjJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXTz',
  },
  {
    id: 'inv-002',
    userId: 'inv-1',
    poolId: 'warung',
    poolName: 'BPRS Amanah Micro-Trade Pool',
    amount: 300,
    apy: 7,
    status: 'active',
    investedAt: '2024-03-15T00:00:00Z',
    maturesAt: '2024-04-30T00:00:00Z',
    expectedReturn: 21,
    currentReturn: 16,
    txHash: '2nL2iTqkPjHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ4',
    receiptHash: 'DrJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXT2',
  },
  {
    id: 'inv-003',
    userId: 'inv-1',
    poolId: 'jamu-herbal',
    poolName: 'BPRS Barokah Consumer Financing Pool',
    amount: 250,
    apy: 8,
    status: 'completed',
    investedAt: '2024-01-10T00:00:00Z',
    maturesAt: '2024-03-10T00:00:00Z',
    expectedReturn: 20,
    currentReturn: 20,
    txHash: '4kL3jTrPkHbK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ5',
    receiptHash: 'HrJvC1wKrFhfJJV3JGKRsVLQMpPqHjLjjTMR4LJQkXT3',
  },
  {
    id: 'inv-004',
    userId: 'inv-2',
    poolId: 'organic-food',
    poolName: 'BPRS Insan Cita Agri Financing Pool',
    amount: 200,
    apy: 9,
    status: 'active',
    investedAt: '2024-03-20T00:00:00Z',
    maturesAt: '2024-05-20T00:00:00Z',
    expectedReturn: 18,
    currentReturn: 8,
    txHash: '3mL4kUsQlHcK2tGDs1R69nJG6vNXQzsgY3hPSKiJBrVVEpXqBqKNvhRvXkUwQGfKTpF9w3R8WzLkBq2kHvFmZ6',
  },
  {
    id: 'inv-005',
    userId: 'inv-2',
    poolId: 'artisan-goods',
    poolName: 'BPRS Barokah Trade Financing Pool',
    amount: 150,
    apy: 7,
    status: 'active',
    investedAt: '2024-02-15T00:00:00Z',
    maturesAt: '2024-04-15T00:00:00Z',
    expectedReturn: 10.5,
    currentReturn: 9,
  },
  {
    id: 'inv-006',
    userId: 'inv-3',
    poolId: 'warung',
    poolName: 'BPRS Amanah Micro-Trade Pool',
    amount: 100,
    apy: 6,
    status: 'active',
    investedAt: '2024-03-25T00:00:00Z',
    maturesAt: '2024-04-25T00:00:00Z',
    expectedReturn: 6,
    currentReturn: 3,
  },
];

// ============================================================================
// MOCK PURCHASE ORDERS
// ============================================================================

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    businessId: 'bus-1',
    businessName: 'Micro-Trade Financing Segment',
    vendorId: 'ven-1',
    vendorName: 'BPRS Amanah Ummah',
    amount: 5000,
    status: 'funded',
    items: [
      { name: 'Micro-trade financing tranche A', quantity: 1, unitPrice: 3000 },
      { name: 'Micro-trade financing tranche B', quantity: 1, unitPrice: 2000 },
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
    businessName: 'Consumer Financing Segment',
    vendorId: 'ven-2',
    vendorName: 'BPRS Barokah Sejahtera',
    amount: 3500,
    status: 'in_progress',
    items: [
      { name: 'Consumer financing tranche', quantity: 1, unitPrice: 2500 },
      { name: 'Servicing reserve', quantity: 1, unitPrice: 1000 },
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
    businessName: 'Micro-Trade Financing Segment',
    amount: 8000,
    status: 'verifying',
    items: [
      { name: 'Micro-trade financing tranche C', quantity: 1, unitPrice: 8000 },
    ],
    createdAt: '2024-03-25T00:00:00Z',
    cooperativeVerified: false,
  },
  {
    id: 'po-004',
    businessId: 'bus-4',
    businessName: 'SME Financing Segment',
    vendorId: 'ven-1',
    vendorName: 'BPRS Amanah Ummah',
    amount: 4500,
    status: 'repaid',
    items: [
      { name: 'SME financing tranche', quantity: 1, unitPrice: 3500 },
      { name: 'Servicing reserve', quantity: 1, unitPrice: 1000 },
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
    businessName: 'Agri Financing Segment',
    amount: 6000,
    status: 'draft',
    items: [
      { name: 'Agri financing tranche', quantity: 1, unitPrice: 6000 },
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
    description: 'Investment in BPRS Barokah Agri Financing Pool',
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
    description: 'Investment in BPRS Amanah Micro-Trade Pool',
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
    description: 'Return from BPRS Barokah Consumer Financing Pool',
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
    description: 'USDC deposit (Arbitrum Sepolia)',
    txHash: '0x9f2c1e7a4b8d5f3e6a2c9b7d1e0f4a8c3b6d5e2f7a1c4b9d8e6f3a2c5b7d1e0f',
  },
  {
    id: 'tx-005',
    userId: 'inv-2',
    type: 'invest',
    amount: 200,
    status: 'completed',
    createdAt: '2024-03-20T11:15:00Z',
    description: 'Investment in BPRS Insan Cita Agri Financing Pool',
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
    description: 'Sell-down funding for pool tranche PO-001',
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
    title: 'Profit Distribution Received',
    message: 'You received $45 profit from your BPRS Barokah Consumer Financing Pool exposure.',
    type: 'success',
    read: false,
    createdAt: '2024-03-28T10:30:00Z',
    actionUrl: '/investor/portfolio',
  },
  {
    id: 'notif-002',
    userId: 'inv-1',
    title: 'New Financing Pool Available',
    message: 'BPRS Amanah SME Financing Pool is now open with an 8 to 11 percent target profit rate.',
    type: 'info',
    read: false,
    createdAt: '2024-03-27T14:20:00Z',
    actionUrl: '/investor/pools',
  },
  {
    id: 'notif-003',
    userId: 'inv-1',
    title: 'Pool Maturity Reminder',
    message: 'Your BPRS Amanah Micro-Trade Pool exposure will mature in 5 days.',
    type: 'warning',
    read: true,
    createdAt: '2024-03-25T09:00:00Z',
    actionUrl: '/investor/portfolio',
  },
  {
    id: 'notif-004',
    userId: 'coop-1',
    title: 'New Pool Approval Request',
    message: 'Micro-Trade Financing Segment submitted a new pool tranche for DPS review.',
    type: 'info',
    read: false,
    createdAt: '2024-03-28T11:00:00Z',
    actionUrl: '/cooperative/verification',
  },
  {
    id: 'notif-005',
    userId: 'bus-1',
    title: 'Pool Tranche Funded',
    message: 'Your financing pool tranche PO-001 has been funded by the investor pool.',
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
  communitiesImpacted: 12,
  countries: 1,
  womenLedBusinesses: 980,
  ruralBusinesses: 1650,
  averageROI: 7.8,
};

// ============================================================================
// MOCK VENDOR SERVICES
// ============================================================================

export const mockVendorServices: VendorService[] = [
  {
    id: 'srv-001',
    vendorId: 'ven-1',
    name: 'Financing Origination',
    category: 'Servicing',
    description: 'Local origination and underwriting of Shariah financing by the BPRS',
    price: 3000,
    unit: 'pool',
    active: true,
    rating: 4.8,
    ordersFulfilled: 156,
  },
  {
    id: 'srv-002',
    vendorId: 'ven-1',
    name: 'Collections & Servicing',
    category: 'Servicing',
    description: 'Ongoing servicing and remittance of collections from the underlying financing',
    price: 2000,
    unit: 'pool',
    active: true,
    rating: 4.7,
    ordersFulfilled: 203,
  },
  {
    id: 'srv-003',
    vendorId: 'ven-1',
    name: 'DPS Akad Review',
    category: 'Shariah',
    description: 'Dewan Pengawas Syariah review of the sell-down akad structure',
    price: 500,
    unit: 'akad',
    active: true,
    rating: 4.9,
    ordersFulfilled: 89,
  },
  {
    id: 'srv-004',
    vendorId: 'ven-2',
    name: 'Pool Verification',
    category: 'Reporting',
    description: 'Continuous verification of pool size, NPF ratio, and akad compliance',
    price: 5,
    unit: 'report',
    active: true,
    rating: 4.5,
    ordersFulfilled: 1240,
  },
  {
    id: 'srv-005',
    vendorId: 'ven-2',
    name: 'SLIK Reporting',
    category: 'Compliance',
    description: 'Regulatory reporting into the OJK SLIK credit information system',
    price: 1000,
    unit: 'period',
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
    vendorName: 'Tawf Structuring Desk',
    cooperativeId: 'coop-1',
    cooperativeName: 'BPRS Amanah Ummah',
    status: 'active',
    startedAt: '2023-11-05T00:00:00Z',
    totalValue: 125000,
    performanceRating: 4.8,
    services: ['Sell-Down Structuring', 'Pool Verification', 'DPS Akad Review'],
  },
  {
    id: 'prt-002',
    vendorId: 'ven-2',
    vendorName: 'Licensed Custodian',
    cooperativeId: 'coop-1',
    cooperativeName: 'BPRS Amanah Ummah',
    status: 'active',
    startedAt: '2024-01-20T00:00:00Z',
    totalValue: 67500,
    performanceRating: 4.6,
    services: ['Custody', 'Settlement'],
  },
  {
    id: 'prt-003',
    vendorId: 'ven-1',
    vendorName: 'Tawf Structuring Desk',
    cooperativeId: 'coop-2',
    cooperativeName: 'BPRS Barokah Sejahtera',
    status: 'active',
    startedAt: '2024-02-01T00:00:00Z',
    totalValue: 45000,
    performanceRating: 4.7,
    services: ['Sell-Down Structuring', 'Pool Verification'],
  },
];

// ============================================================================
// MOCK COMPLIANCE DOCUMENTS
// ============================================================================

export const mockComplianceDocuments: ComplianceDocument[] = [
  {
    id: 'doc-001',
    userId: 'ven-1',
    documentType: 'OJK Business License',
    fileName: 'OJK_izin_bprs-amanah-ummah.pdf',
    status: 'verified',
    uploadedAt: '2023-11-05T00:00:00Z',
    expiresAt: '2025-11-05T00:00:00Z',
  },
  {
    id: 'doc-002',
    userId: 'ven-1',
    documentType: 'DPS Akad Approval',
    fileName: 'DPS_akad_bprs-amanah-ummah.pdf',
    status: 'verified',
    uploadedAt: '2023-11-05T00:00:00Z',
  },
  {
    id: 'doc-003',
    userId: 'bus-1',
    documentType: 'Financing Pool Register',
    fileName: 'pool_microtrade-segment.pdf',
    status: 'verified',
    uploadedAt: '2023-12-01T00:00:00Z',
  },
  {
    id: 'doc-004',
    userId: 'bus-1',
    documentType: 'SLIK Report',
    fileName: 'SLIK_microtrade-segment.pdf',
    status: 'verified',
    uploadedAt: '2023-12-01T00:00:00Z',
  },
  {
    id: 'doc-005',
    userId: 'bus-3',
    documentType: 'Financing Pool Register',
    fileName: 'pool_agri-segment.pdf',
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
    businessName: 'Micro-Trade Financing Segment',
    businessType: 'Micro-Trade',
    registrationNumber: 'POOL-1234567890',
    foundedYear: 2019,
    employees: 4,
    annualRevenue: 85000,
    description: 'A pool of micro-trade working-capital financing originated and serviced by BPRS Amanah Ummah.',
    location: 'Jakarta Selatan, DKI Jakarta',
    tawfScore: 78,
    verifiedBy: ['coop-1'],
    linkedCooperatives: ['coop-1'],
  },
  {
    id: 'prof-002',
    userId: 'bus-2',
    businessName: 'Consumer Financing Segment',
    businessType: 'Consumer Financing',
    registrationNumber: 'POOL-0987654321',
    foundedYear: 2021,
    employees: 8,
    annualRevenue: 120000,
    description: 'A pool of Shariah consumer financing originated and serviced by BPRS Barokah Sejahtera.',
    location: 'Yogyakarta, DIY',
    tawfScore: 82,
    verifiedBy: ['coop-1'],
    linkedCooperatives: ['coop-1'],
  },
  {
    id: 'prof-003',
    userId: 'bus-3',
    businessName: 'Agri Financing Segment',
    businessType: 'Agri Financing',
    registrationNumber: 'POOL-1122334455',
    foundedYear: 2020,
    employees: 6,
    annualRevenue: 65000,
    description: 'A pool of seasonal agricultural financing serviced by BPRS Insan Cita.',
    location: 'Bandung, West Java',
    tawfScore: 71,
    verifiedBy: [],
    linkedCooperatives: ['coop-2'],
  },
  {
    id: 'prof-004',
    userId: 'bus-4',
    businessName: 'SME Financing Segment',
    businessType: 'SME Financing',
    registrationNumber: 'POOL-5544332211',
    foundedYear: 2018,
    employees: 12,
    annualRevenue: 150000,
    description: 'A pool of small-enterprise financing serviced by BPRS Amanah Ummah under a musyarakah sell-down.',
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
    message: 'BPRS Barokah Agri Financing Pool is 85% funded. Consider opening a new pool.',
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
  // In a real system, this would check which BPRS originator is assigned
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
