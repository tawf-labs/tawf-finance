use anchor_lang::prelude::*;

declare_id!("AMoZmLsczBZBx8XPjFPbJRDXawb54pdwjD5ZjfjJMz72");

#[program]
pub mod tawf_investment {
    use super::*;

    /// Initialize a new investment pool
    ///
    /// # Arguments
    /// * `ctx` - Context containing pool account and authority
    /// * `name` - Pool name (max 50 chars)
    /// * `apy_min` - Minimum APY in basis points (e.g., 1200 = 12%)
    /// * `apy_max` - Maximum APY in basis points
    /// * `duration_min` - Minimum duration in days
    /// * `duration_max` - Maximum duration in days
    /// * `min_investment` - Minimum investment in lamports
    /// * `funding_target` - Target funding amount in lamports
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        name: String,
        apy_min: u16,
        apy_max: u16,
        duration_min: u32,
        duration_max: u32,
        min_investment: u64,
        funding_target: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let clock = Clock::get()?;

        // Validate inputs
        require!(name.len() <= 50, TawfError::NameTooLong);
        require!(apy_min <= apy_max, TawfError::InvalidAPY);
        require!(duration_min <= duration_max, TawfError::InvalidDuration);
        require!(min_investment > 0, TawfError::InvalidAmount);
        require!(funding_target > 0, TawfError::InvalidAmount);

        // Initialize pool account
        pool.authority = ctx.accounts.authority.key();
        pool.name = name;
        pool.apy_min = apy_min;
        pool.apy_max = apy_max;
        pool.duration_min = duration_min;
        pool.duration_max = duration_max;
        pool.min_investment = min_investment;
        pool.funding_target = funding_target;
        pool.total_invested = 0;
        pool.investor_count = 0;
        pool.created_at = clock.unix_timestamp;
        pool.bump = ctx.bumps.pool;

        msg!("Pool initialized: {}", pool.name);
        Ok(())
    }

    /// Invest in a pool
    ///
    /// # Arguments
    /// * `ctx` - Context containing pool and investor accounts
    /// * `amount` - Investment amount in lamports
    pub fn invest(ctx: Context<Invest>, amount: u64) -> Result<()> {
        // Validate investment before borrowing
        require!(
            amount >= ctx.accounts.pool.min_investment,
            TawfError::AmountBelowMinimum
        );

        // Transfer SOL from investor to pool
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.investor.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );
        anchor_lang::system_program::transfer(cpi_ctx, amount)?;

        // Update pool state
        let pool = &mut ctx.accounts.pool;
        pool.total_invested += amount;
        pool.investor_count += 1;

        msg!(
            "Investment of {} lamports in pool {}",
            amount,
            pool.name
        );
        Ok(())
    }

    /// Distribute returns to investors (authority only)
    ///
    /// # Arguments
    /// * `ctx` - Context containing pool and authority accounts
    /// * `total_returns` - Total returns to distribute in lamports
    pub fn distribute_returns(ctx: Context<DistributeReturns>, total_returns: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // Verify authority
        require!(
            ctx.accounts.authority.key() == pool.authority,
            TawfError::Unauthorized
        );

        // Update pool state (in production, would distribute to individual investors)
        pool.total_distributed += total_returns;

        msg!(
            "Distributed {} lamports returns for pool {}",
            total_returns,
            pool.name
        );
        Ok(())
    }

    /// Withdraw matured investment
    ///
    /// # Arguments
    /// * `ctx` - Context containing pool and investor accounts
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // In production, this would:
        // 1. Check if investment is matured
        // 2. Calculate returns
        // 3. Transfer principal + returns to investor
        // 4. Update pool state

        pool.investor_count -= 1;

        msg!("Withdrawal processed for pool {}", pool.name);
        Ok(())
    }
}

// Account structures

#[account]
pub struct InvestmentPool {
    pub authority: Pubkey,
    pub name: String,
    pub apy_min: u16,
    pub apy_max: u16,
    pub duration_min: u32,
    pub duration_max: u32,
    pub min_investment: u64,
    pub funding_target: u64,
    pub total_invested: u64,
    pub total_distributed: u64,
    pub investor_count: u32,
    pub created_at: i64,
    pub bump: u8,
}

// Instruction contexts

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 50 + 2 + 2 + 4 + 4 + 8 + 8 + 8 + 8 + 4 + 8 + 1,
        seeds = [b"pool", authority.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, InvestmentPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub pool: Account<'info, InvestmentPool>,

    #[account(mut)]
    pub investor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeReturns<'info> {
    #[account(mut)]
    pub pool: Account<'info, InvestmentPool>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub pool: Account<'info, InvestmentPool>,

    #[account(mut)]
    pub investor: Signer<'info>,
}

// Error codes

#[error_code]
pub enum TawfError {
    #[msg("Pool name is too long")]
    NameTooLong,

    #[msg("Invalid APY range")]
    InvalidAPY,

    #[msg("Invalid duration range")]
    InvalidDuration,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Amount below minimum investment")]
    AmountBelowMinimum,

    #[msg("Unauthorized operation")]
    Unauthorized,
}
