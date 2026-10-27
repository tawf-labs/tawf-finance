/**
 * Issuers onboarded on Tawf, by type.
 *
 * - `bprs`: a licensed Indonesian Islamic rural bank (Bank Pembiayaan Rakyat
 *   Syariah). Tawf wraps the deposito it places at several BPRS of a region
 *   into one Tawf Deposito Pool. A BPRS does not issue sukuk here: that needs
 *   IDR 80bn core capital (POJK 7/2024 Art 35), which almost no BPRS has.
 * - `scf`: a securities crowdfunding platform licensed by OJK under POJK
 *   57/2020 ("Layanan Urun Dana"), such as LBS Urun Dana. The platform lists
 *   sharia sukuk and shares of SMEs (UMKM), and Tawf tokenizes each offering
 *   as an ERC-3643 token that enforces the POJK investor limit on chain.
 *
 * The names below are fictional demo entities. They do not refer to any real
 * platform or company.
 */
export type IssuerType = 'bprs' | 'scf';

export interface IssuerPlatform {
  id: string;
  type: IssuerType;
  name: string;
  license: string;
  shariahBoard: string;
  description: string;
  demo: boolean;
}

export interface ScfOffering {
  id: string;
  platformId: string;
  issuerName: string;
  sector: string;
  location: string;
  instrument: string;
  akad: string;
  useOfProceeds: string;
  /** Indicative profit share for the investors, not a promised return. */
  indicativeNisbah: string;
  /** POJK 57/2020 cap on what one SME issuer may raise through SCF in IDR. */
  issuerCapIdr: number;
}

export const ISSUER_TYPE_LABEL: Record<IssuerType, string> = {
  bprs: 'Islamic rural bank (BPRS)',
  scf: 'Securities crowdfunding platform (SCF)',
};

export const SCF_PLATFORM: IssuerPlatform = {
  id: 'demo-urun-dana-syariah',
  type: 'scf',
  name: 'Demo Urun Dana Syariah',
  license: 'Fictional demo platform. A real platform holds an OJK licence as a Penyelenggara Layanan Urun Dana under POJK 57/2020 (as amended by POJK 16/2021).',
  shariahBoard: 'Platform Dewan Pengawas Syariah (demo)',
  description:
    'A sharia securities crowdfunding platform that lists sukuk and sharia shares of Indonesian SMEs. Each offering is tokenized on Tawf, and the token enforces the POJK investor limit across all of the platform\'s offerings.',
  demo: true,
};

export const SCF_OFFERING: ScfOffering = {
  id: 'tawf.scf.umkm.1',
  platformId: SCF_PLATFORM.id,
  issuerName: 'CV Kopi Nusantara Demo',
  sector: 'Food and beverage (coffee roastery)',
  location: 'Bandung, West Java',
  instrument: 'Sukuk Mudharabah',
  akad: 'Mudharabah: investors provide capital, the SME manages the business, profit is shared by an agreed ratio and losses are borne by the capital',
  useOfProceeds: 'Working capital for green bean stock and a second roasting machine',
  indicativeNisbah: '60% investors / 40% issuer of realized profit',
  issuerCapIdr: 10_000_000_000,
};
