import { Link } from 'react-router-dom';
import { Reveal } from '@/components/landing/Reveal';
import { Chapter, PageHero, PublicPage, Tile, ghost, solid, type Tint } from '@/components/landing/PublicPage';
import { instrumentCatalog, type AkadFamily, type InstrumentStatus } from '@/data/mockData';

const familyOrder: AkadFamily[] = ['Debt-based', 'Equity-based', 'Tradable', 'Social'];

const familyBlurb: Record<AkadFamily, string> = {
  'Debt-based': 'Sale and lease structures with a defined return. Debt-like risk, lower band.',
  'Equity-based': 'Partnership and agency structures that share real profit and loss.',
  'Tradable': 'Certificate structures built for transfer once the licensing path is clear.',
  'Social': 'Benevolent, principal-only structures funded through the Baitul Maal side.',
};

// Same family-to-tint pairing as the landing coverage wall.
const familyTint: Record<AkadFamily, Tint> = {
  'Debt-based': 'mint',
  'Equity-based': 'butter',
  'Tradable': 'stone',
  'Social': 'peach',
};

function statusStyle(status: InstrumentStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'Live':
      return { bg: 'bg-mint', text: 'text-jade-deep', dot: 'bg-jade' };
    case 'Structured':
      return { bg: 'bg-butter', text: 'text-ink', dot: 'bg-honey' };
    case 'Pipeline':
      return { bg: 'bg-peach', text: 'text-ink', dot: 'bg-clay' };
    case 'Roadmap':
    default:
      return { bg: 'bg-stone', text: 'text-ink/70', dot: 'bg-ink/40' };
  }
}

const STATUS_NOTES: [InstrumentStatus, string][] = [
  ['Live', 'Running in the pilot today. The mudharabah deposito behind the Tawf Deposito Pool.'],
  ['Structured', 'Akad drafted and modeled, awaiting a design-partner bank to validate. Not in the pilot.'],
  ['Pipeline', 'Scoped for a specific segment, not yet drafted. Not in the pilot.'],
  ['Roadmap', 'Planned once the capital and licensing conditions are met (Sukuk needs IDR 80bn core capital).'],
];

export function Instruments() {
  return (
    <PublicPage>
      <PageHero
        eyebrow="Instruments"
        title="One infrastructure for every"
        accent="Islamic finance akad."
        lead="The pilot runs on one akad, the mudharabah deposito behind the Tawf Deposito Pool, plus sharia crowdfunding for SMEs. The rest of the catalogue is reference for what the same primitive can carry later, and most of it is not in the pilot."
        actions={
          <>
            <Link to="/how-it-works" className={solid}>How it works</Link>
            <Link to="/glossary" className={ghost}>Read the glossary</Link>
          </>
        }
      />

      {familyOrder.map((family, fi) => {
        const items = instrumentCatalog.filter((i) => i.family === family);
        if (items.length === 0) return null;
        const prev = fi === 0 ? 'stone' : familyTint[familyOrder[fi - 1]];
        return (
          <Chapter key={family} tint={familyTint[family]} from={prev} eyebrow="Akad family" title={family} lead={familyBlurb[family]}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((inst, i) => {
                const s = statusStyle(inst.status);
                return (
                  <Reveal key={inst.id} delay={(i % 3) * 0.07}>
                    <Tile className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="display text-2xl">{inst.name}</h3>
                          <p className="mt-1 text-sm text-ink/60" lang="ar" dir="rtl">{inst.arabic}</p>
                        </div>
                        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {inst.status}
                        </span>
                      </div>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/70">{inst.summary}</p>
                      <dl className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink/60">Typical use</dt>
                          <dd className="text-right">{inst.useCase}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink/60">Reference band</dt>
                          <dd className="text-right font-medium">{inst.yieldBand}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-ink/60">Reference</dt>
                          <dd className="text-right">{inst.dsnRef}</dd>
                        </div>
                      </dl>
                    </Tile>
                  </Reveal>
                );
              })}
            </div>
          </Chapter>
        );
      })}

      <Chapter tint="paper" from={familyTint[familyOrder[familyOrder.length - 1]]} eyebrow="Status labels" title="How to read" accent="the labels.">
        <Reveal>
          <Tile tint="stone" className="max-w-3xl">
            <p className="mb-5 text-sm text-ink/70">Reference bands describe the structure, not an offer. Nothing here is a promise of return.</p>
            <ul className="space-y-4 text-sm">
              {STATUS_NOTES.map(([status, note]) => {
                const s = statusStyle(status);
                return (
                  <li key={status} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {status}
                    </span>
                    <span className="text-ink/75">{note}</span>
                  </li>
                );
              })}
            </ul>
          </Tile>
        </Reveal>
      </Chapter>
    </PublicPage>
  );
}
