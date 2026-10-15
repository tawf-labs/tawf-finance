import type { AkadFamily } from '@/data/mockData';

// Akad family decides a surface's tint: pool cards and the coverage wall share the key.
export const FAMILY_TINT: Record<AkadFamily, string> = {
  'Debt-based': 'bg-mint',
  'Equity-based': 'bg-butter',
  Social: 'bg-peach',
  Tradable: 'bg-white',
};

// Chapter seams: each section starts in the colour of the one above and settles
// into its own, so the page reads as one continuous surface.
export const FADE = {
  lifecycle: 'bg-[linear-gradient(to_bottom,var(--color-stone),var(--color-paper)_10rem)]',
  receipt: 'bg-[linear-gradient(to_bottom,var(--color-paper),var(--color-butter)_14rem)]',
  coverage: 'bg-[linear-gradient(to_bottom,var(--color-butter),var(--color-stone)_14rem)]',
  impact: 'bg-[linear-gradient(to_bottom,var(--color-stone),var(--color-mint)_14rem)]',
  pools: 'bg-[linear-gradient(to_bottom,var(--color-mint),var(--color-peach)_14rem)]',
  epilogue: 'bg-[linear-gradient(to_bottom,var(--color-peach),var(--color-mint)_12rem,var(--color-mint)_calc(100%-12rem),#fff)]',
};
