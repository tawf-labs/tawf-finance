use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("TAWFNFT1111111111111111111111111111111");

#[program]
pub mod tawf_nft {
    use super::*;

    /// Mint a soulbound NFT receipt for an investment
    ///
    /// # Arguments
    /// * `ctx` - Context containing all required accounts
    /// * `pool_name` - Name of the investment pool
    /// * `amount` - Investment amount in lamports
    /// * `apy` - Annual percentage yield in basis points
    /// * `matures_at` - Unix timestamp when investment matures
    pub fn mint_receipt(
        ctx: Context<MintReceipt>,
        pool_name: String,
        amount: u64,
        apy: u16,
        matures_at: i64,
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;
        let clock = Clock::get()?;

        // Validate inputs
        require!(pool_name.len() <= 50, TawfNftError::NameTooLong);
        require!(amount > 0, TawfNftError::InvalidAmount);

        // Initialize receipt account
        receipt.authority = ctx.accounts.minter.key();
        receipt.pool_name = pool_name.clone();
        receipt.amount = amount;
        receipt.apy = apy;
        receipt.invested_at = clock.unix_timestamp;
        receipt.matures_at = matures_at;
        receipt.expected_return = amount + (amount * apy as u64 / 10000);
        receipt.current_return = 0;
        receipt.status = ReceiptStatus::Active as u8;
        receipt.bump = ctx.bumps.receipt;

        // Mint the NFT token to the investor
        let seeds = &[
            b"receipt",
            ctx.accounts.minter.key().as_ref(),
            pool_name.as_bytes(),
            &[ctx.bumps.receipt],
        ];
        let signer = &[&seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: receipt.to_account_info(),
            },
            signer,
        );

        token::mint_to(mint_ctx, 1)?; // Mint 1 NFT

        msg!("Receipt NFT minted for pool: {}", pool_name);
        Ok(())
    }

    /// Update receipt with current return data
    ///
    /// # Arguments
    /// * `ctx` - Context containing receipt and authority
    /// * `current_return` - Current return amount in lamports
    pub fn update_receipt(
        ctx: Context<UpdateReceipt>,
        current_return: u64,
    ) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == receipt.authority,
            TawfNftError::Unauthorized
        );

        receipt.current_return = current_return;

        msg!(
            "Receipt updated for pool: {}, current return: {}",
            receipt.pool_name,
            current_return
        );
        Ok(())
    }

    /// Mark receipt as completed when investment matures
    ///
    /// # Arguments
    /// * `ctx` - Context containing receipt and authority
    pub fn complete_receipt(ctx: Context<UpdateReceipt>) -> Result<()> {
        let receipt = &mut ctx.accounts.receipt;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == receipt.authority,
            TawfNftError::Unauthorized
        );

        receipt.status = ReceiptStatus::Completed as u8;

        msg!("Receipt completed for pool: {}", receipt.pool_name);
        Ok(())
    }
}

// Account structures

#[account]
pub struct ReceiptNFT {
    pub authority: Pubkey,
    pub pool_name: String,
    pub amount: u64,
    pub apy: u16,
    pub invested_at: i64,
    pub matures_at: i64,
    pub expected_return: u64,
    pub current_return: u64,
    pub status: u8,
    pub bump: u8,
}

// Receipt status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ReceiptStatus {
    Active = 0,
    Completed = 1,
    Defaulted = 2,
}

// Instruction contexts

#[derive(Accounts)]
pub struct MintReceipt<'info> {
    #[account(
        init,
        payer = minter,
        space = 8 + 32 + 50 + 8 + 2 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"receipt", minter.key().as_ref(), pool_name.as_bytes()],
        bump
    )]
    pub receipt: Account<'info, ReceiptNFT>,

    #[account(
        init,
        payer = minter,
        mint::decimals = 0,
        mint::authority = receipt,
        mint::freeze_authority = receipt,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = minter,
        token::mint = mint,
        token::authority = receipt,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub minter: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReceipt<'info> {
    #[account(mut)]
    pub receipt: Account<'info, ReceiptNFT>,

    pub authority: Signer<'info>,
}

// Error codes

#[error_code]
pub enum TawfNftError {
    #[msg("Pool name is too long")]
    NameTooLong,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Unauthorized operation")]
    Unauthorized,

    #[msg("Receipt not found")]
    ReceiptNotFound,

    #[msg("Receipt already completed")]
    AlreadyCompleted,
}
