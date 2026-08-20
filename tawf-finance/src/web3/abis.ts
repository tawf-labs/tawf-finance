/**
 * Compiled ABIs exported straight from the Foundry build (via `forge inspect`),
 * so the frontend can never drift from the deployed bytecode.
 */
import type { Abi } from 'viem';
import DealRegistryAbiJson from './abis/DealRegistry.json';
import BondReceiptNFTAbiJson from './abis/BondReceiptNFT.json';
import RedemptionVaultAbiJson from './abis/RedemptionVault.json';
import MockUsdcAbiJson from './abis/MockUSDC.json';

export const DealRegistryAbi = DealRegistryAbiJson as unknown as Abi;
export const BondReceiptNFTAbi = BondReceiptNFTAbiJson as unknown as Abi;
export const RedemptionVaultAbi = RedemptionVaultAbiJson as unknown as Abi;
export const MockUsdcAbi = MockUsdcAbiJson as unknown as Abi;
