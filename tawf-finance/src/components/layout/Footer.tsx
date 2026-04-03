import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const stakingPools = [
  { name: 'Kurban Farms Pool', href: '/#pools' },
  { name: 'Warung Pool', href: '/#pools' },
  { name: 'Jamu & Herbal Pool', href: '/#pools' },
  { name: 'Organic Food Pool', href: '/#pools' },
  { name: 'Artisan Goods Pool', href: '/#pools' },
];

const platformLinks = [
  { name: 'Tawf ID', href: 'https://id.tawf.foundation' },
  { name: 'Dashboard', href: '/investor/dashboard' },
];

const foundationLinks = [
  { name: 'Our Mission', href: '/about' },
  { name: 'Governance', href: 'https://tawf.foundation' },
  { name: 'Org Structure', href: 'https://tawf.foundation' },
  { name: 'Manifesto', href: 'https://tawf.foundation' },
];

const resourceLinks = [
  { name: 'Glossary', href: '/glossary' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Contact', href: '/contact' },
  { name: 'Privacy Policy', href: '/contact' },
  { name: 'Terms of Service', href: '/contact' },
];

function FooterColumn({ title, links, delay }: { title: string; links: { name: string; href: string }[]; delay: number }) {
  const isExternal = (href: string) => href.startsWith('http');

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
            {isExternal(link.href) ? (
              <a href={link.href} className="text-white/40 hover:text-tawf-gold transition-colors text-sm">
                {link.name}
              </a>
            ) : (
              <Link to={link.href} className="text-white/40 hover:text-tawf-gold transition-colors text-sm">
                {link.name}
              </Link>
            )}
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
