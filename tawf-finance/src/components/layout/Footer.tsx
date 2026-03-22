import { motion } from 'framer-motion';

const stakingPools = [
  { name: 'Kurban Farms Pool', href: '#' },
  { name: 'Warung Pool', href: '#' },
  { name: 'Jamu & Herbal Pool', href: '#' },
  { name: 'Organic Food Pool', href: '#' },
  { name: 'Artisan Goods Pool', href: '#' },
];

const platformLinks = [
  { name: 'Tawf ID', href: 'https://id.tawf.foundation' },
];

const foundationLinks = [
  { name: 'Our Mission', href: '#' },
  { name: 'Governance', href: '#' },
  { name: 'Org Structure', href: '#' },
  { name: 'Manifesto', href: '#' },
];

const resourceLinks = [
  { name: 'Glossary', href: '#' },
  { name: 'Research', href: '#' },
  { name: 'Contact', href: '#' },
  { name: 'Privacy Policy', href: '#' },
  { name: 'Terms of Service', href: '#' },
];

function FooterColumn({ title, links, delay }: { title: string; links: { name: string; href: string }[]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
    >
      <h3 className="font-medium text-white/80 mb-4">{title}</h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.name}>
            <a href={link.href} className="text-white/40 hover:text-tawf-gold transition-colors text-sm">
              {link.name}
            </a>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export function Footer() {
  return (
    <footer className="bg-tawf-ink text-white">
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-white mb-3">Tawf Labs</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              We tokenize the underserved economy. Stake and earn real yield while
              providing working capital for Southeast Asian MSMEs.
            </p>
            <p className="text-white/40 text-sm">Governed by Tawf Foundation</p>
          </motion.div>

          <FooterColumn title="Staking Pools" links={stakingPools} delay={0.1} />
          <FooterColumn title="Platform" links={platformLinks} delay={0.2} />
          <FooterColumn title="Foundation" links={foundationLinks} delay={0.3} />
          <FooterColumn title="Resources" links={resourceLinks} delay={0.4} />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="pt-8 border-t border-white/10 flex items-center justify-center"
        >
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Tawf Labs. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
