import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Mail, Building2, Users, Handshake, Send } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

const partnershipTypes = [
  {
    icon: Building2,
    title: 'Cooperative Partnership',
    description: 'BMTs and cooperatives across Indonesia & Malaysia',
  },
  {
    icon: Users,
    title: 'Investor Partnership',
    description: 'Institutional investors and funding partners',
  },
  {
    icon: Handshake,
    title: 'Strategic Alliance',
    description: 'Technology, compliance, and distribution partners',
  },
];

export function Contact() {
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
    <div>
      {/* Hero Section */}
      <Section className="py-20 md:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center justify-center gap-2 w-16 h-16 rounded-full bg-tawf-green/10 mb-6">
            <Mail className="w-8 h-8 text-tawf-green" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-serif text-4xl md:text-5xl lg:text-6xl text-tawf-green leading-tight mb-6"
          >
            Partner With Us
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-tawf-muted text-lg md:text-xl leading-relaxed"
          >
            We're building the future of ethical finance in Southeast Asia. Join us in
            empowering millions of underserved businesses with transparent, Sharia-compliant
            investment opportunities.
          </motion.p>
        </motion.div>
      </Section>

      {/* Partnership Types */}
      <Section className="py-16 bg-white">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <motion.h2
            variants={itemVariants}
            className="font-serif text-2xl md:text-3xl text-tawf-green text-center mb-12"
          >
            Partnership Opportunities
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {partnershipTypes.map((type) => (
              <motion.div
                key={type.title}
                variants={itemVariants}
                className="p-6 rounded-2xl bg-tawf-sand/50 border border-tawf-green/10 hover:border-tawf-gold/30 transition-colors"
              >
                <type.icon className="w-8 h-8 text-tawf-gold mb-4" />
                <h3 className="font-serif text-xl text-tawf-green mb-2">{type.title}</h3>
                <p className="text-tawf-muted text-sm">{type.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* Contact Form */}
      <Section className="py-16 md:py-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <motion.div variants={itemVariants}>
            <h2 className="font-serif text-2xl md:text-3xl text-tawf-green text-center mb-4">
              Get in Touch
            </h2>
            <p className="text-tawf-muted text-center mb-8">
              Fill out the form below and we'll get back to you within 24-48 hours.
            </p>
          </motion.div>

          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-tawf-ink mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-tawf-green/20 bg-white focus:border-tawf-gold focus:outline-none focus:ring-2 focus:ring-tawf-gold/20 transition-colors"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-tawf-ink mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-tawf-green/20 bg-white focus:border-tawf-gold focus:outline-none focus:ring-2 focus:ring-tawf-gold/20 transition-colors"
                  placeholder="you@organization.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-tawf-ink mb-2">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="organization"
                name="organization"
                required
                className="w-full px-4 py-3 rounded-lg border border-tawf-green/20 bg-white focus:border-tawf-gold focus:outline-none focus:ring-2 focus:ring-tawf-gold/20 transition-colors"
                placeholder="Your cooperative, company, or organization"
              />
            </div>

            <div>
              <label htmlFor="partnershipType" className="block text-sm font-medium text-tawf-ink mb-2">
                Partnership Type <span className="text-red-500">*</span>
              </label>
              <select
                id="partnershipType"
                name="partnershipType"
                required
                className="w-full px-4 py-3 rounded-lg border border-tawf-green/20 bg-white focus:border-tawf-gold focus:outline-none focus:ring-2 focus:ring-tawf-gold/20 transition-colors"
              >
                <option value="">Select partnership type</option>
                <option value="Cooperative Partnership">Cooperative Partnership (BMT/Koperasi)</option>
                <option value="Investor Partnership">Investor Partnership</option>
                <option value="Strategic Alliance">Strategic Alliance</option>
                <option value="Technology Partnership">Technology Partnership</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-tawf-ink mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-tawf-green/20 bg-white focus:border-tawf-gold focus:outline-none focus:ring-2 focus:ring-tawf-gold/20 transition-colors resize-none"
                placeholder="Tell us about your organization and what kind of partnership you're interested in..."
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full md:w-auto group"
            >
              <Send className="mr-2 w-4 h-4" />
              Send Partnership Inquiry
              <Send className="ml-2 w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Button>
          </motion.form>

          <motion.p
            variants={itemVariants}
            className="text-tawf-muted text-sm text-center mt-8"
          >
            Or email us directly at{' '}
            <a
              href="mailto:hello@tawf.finance"
              className="text-tawf-green hover:text-tawf-gold transition-colors underline underline-offset-2"
            >
              hello@tawf.finance
            </a>
          </motion.p>
        </motion.div>
      </Section>
    </div>
  );
}
