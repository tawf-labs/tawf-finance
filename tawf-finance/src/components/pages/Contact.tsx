import { useSearchParams } from 'react-router-dom';
import { Building2, Users, Handshake, Send, Rocket } from 'lucide-react';
import { PublicPage, PageHero, Chapter, Tile, solid } from '../landing/PublicPage';
import { Reveal } from '../landing/Reveal';

const partnershipTypes = [
  {
    icon: Rocket,
    title: 'SCF Platform Partnership',
    description: 'Licensed crowdfunding (urun dana) platforms and SME issuers',
  },
  {
    icon: Building2,
    title: 'BPRS Deposito Partnership',
    description: 'Licensed Shariah rural banks that want to take deposito in each customer\'s name, placed through Tawf, for the Deposito Pool (rupiah deposits opening soon)',
  },
  {
    icon: Users,
    title: 'Investor Partnership',
    description: 'Institutional investors and funding partners',
  },
  {
    icon: Handshake,
    title: 'Strategic Alliance',
    description: 'Technology, custody, compliance, and distribution partners',
  },
];

const field = 'w-full rounded-2xl bg-white px-4 py-3 text-ink ring-1 ring-ink/15 transition focus:outline-none focus:ring-2 focus:ring-jade';
const label = 'mb-2 block text-sm font-medium text-ink';

export function Contact() {
  // The Deposito waitlist button links here with the type and a topic preset.
  const [params] = useSearchParams();
  const presetType = params.get('type') ?? '';
  const presetMessage = params.get('topic') === 'deposito-waitlist' ? 'Please add me to the Tawf Deposito Pool waitlist.' : '';
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const organization = formData.get('organization') as string;
    const partnershipType = formData.get('partnershipType') as string;
    const message = formData.get('message') as string;

    const subject = encodeURIComponent(`Partnership Inquiry: ${organization || name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nOrganization: ${organization}\n\nPartnership Type: ${partnershipType}\n\nMessage:\n${message}`
    );

    window.location.href = `mailto:hello@tawf.finance?subject=${subject}&body=${body}`;
  };

  return (
    <PublicPage>
      <PageHero
        eyebrow="Contact"
        title="Partner"
        accent="with us"
        lead="We are building tokenized sharia crowdfunding for SMEs, and Shariah deposito at licensed BPRS (rupiah deposits opening soon). Talk to us if you run an SME offering, operate a licensed crowdfunding platform, run a BPRS, invest, or build the rails around them. The pilot is on testnet."
      />

      <Chapter tint="paper" from="stone" eyebrow="Partnerships" title="Partnership" accent="opportunities">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {partnershipTypes.map((type, i) => (
            <Reveal key={type.title} delay={i * 0.08} className="h-full">
              <Tile tint="stone" className="h-full">
                <type.icon className="mb-5 h-8 w-8 text-jade" />
                <h3 className="display text-2xl">{type.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/70">{type.description}</p>
              </Tile>
            </Reveal>
          ))}
        </div>
      </Chapter>

      <Chapter tint="stone" from="paper" eyebrow="Get in touch" title="Send us a" accent="message" lead="Fill out the form and we reply as soon as we can.">
        <Reveal className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="name" className={label}>
                  Full Name <span className="text-clay">*</span>
                </label>
                <input type="text" id="name" name="name" required className={field} placeholder="Your name" />
              </div>
              <div>
                <label htmlFor="email" className={label}>
                  Email Address <span className="text-clay">*</span>
                </label>
                <input type="email" id="email" name="email" required className={field} placeholder="you@organization.com" />
              </div>
            </div>
            <div>
              <label htmlFor="organization" className={label}>
                Organization Name <span className="text-clay">*</span>
              </label>
              <input
                type="text"
                id="organization"
                name="organization"
                required
                className={field}
                placeholder="Your BPRS, company, or organization"
              />
            </div>
            <div>
              <label htmlFor="partnershipType" className={label}>
                Partnership Type <span className="text-clay">*</span>
              </label>
              <select id="partnershipType" name="partnershipType" required defaultValue={presetType} className={field}>
                <option value="">Select partnership type</option>
                <option value="SCF Platform Partnership">SCF Platform Partnership</option>
                <option value="BPRS Deposito Partnership">BPRS Deposito Partnership</option>
                <option value="Investor Partnership">Investor Partnership</option>
                <option value="Strategic Alliance">Strategic Alliance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className={label}>
                Message <span className="text-clay">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                defaultValue={presetMessage}
                className={`${field} resize-none`}
                placeholder="Tell us about your organization and what kind of partnership you're interested in..."
              />
            </div>
            <button type="submit" className={`${solid} w-full justify-center md:w-auto`}>
              <Send className="mr-2 h-4 w-4" />
              Send Partnership Inquiry
            </button>
          </form>
          <p className="mt-8 text-center text-sm text-ink/65">
            Or email us directly at{' '}
            <a href="mailto:hello@tawf.finance" className="text-jade underline underline-offset-2 hover:text-ink">
              hello@tawf.finance
            </a>
          </p>
        </Reveal>
      </Chapter>
    </PublicPage>
  );
}
