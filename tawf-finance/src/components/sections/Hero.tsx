import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ArrowRight, AlertCircle, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Section } from '../ui/Section';

export function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] as const },
    },
  };

  return (
    <Section className="relative min-h-screen flex items-center pt-20">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto text-center"
      >
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tawf-green/5 border border-tawf-green/30 mb-4"
        >
          <AlertCircle className="w-4 h-4 text-tawf-green" />
          <span className="label text-tawf-green text-sm font-medium">
            Testnet Mode — Auditing in Progress, Seeking Partners
          </span>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-tawf-green/10 border border-tawf-green/20 mb-6"
        >
          <span className="label text-tawf-gold">Southeast Asia First</span>
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-serif text-5xl md:text-6xl lg:text-7xl text-tawf-green leading-[1.1] mb-6"
        >
          We Tokenize the
          <span className="block text-tawf-gold">Underserved Economy</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-tawf-muted text-lg md:text-xl leading-relaxed mb-8"
        >
          Earn real returns while supporting local businesses across Southeast Asia.
          Starting from <span className="text-tawf-green font-medium">$10</span>.
          Transparent, ethical, and grounded in real trade.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link to="/investor/dashboard">
            <Button size="lg" className="group">
              Start Investing
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button variant="secondary" size="lg">
              <Mail className="mr-2 w-4 h-4" />
              Partner With Us
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center justify-center gap-8">
          <div>
            <p className="font-serif text-3xl md:text-4xl text-tawf-green">8-18%</p>
            <p className="text-tawf-muted text-sm">Annual Yield</p>
          </div>
          <div className="w-px h-12 bg-tawf-green/20" />
          <div>
            <p className="font-serif text-3xl md:text-4xl text-tawf-green">30-90</p>
            <p className="text-tawf-muted text-sm">Day Duration</p>
          </div>
          <div className="w-px h-12 bg-tawf-green/20" />
          <div>
            <p className="font-serif text-3xl md:text-4xl text-tawf-green">$10</p>
            <p className="text-tawf-muted text-sm">Min Investment</p>
          </div>
        </motion.div>

        <motion.p variants={itemVariants} className="text-tawf-muted text-sm mt-6">
          Governed by{' '}
          <a href="https://tawf.foundation" target="_blank" rel="noopener noreferrer" className="text-tawf-green hover:text-tawf-gold transition-colors underline underline-offset-2">
            Tawf Foundation ↗
          </a>
        </motion.p>
      </motion.div>
    </Section>
  );
}
