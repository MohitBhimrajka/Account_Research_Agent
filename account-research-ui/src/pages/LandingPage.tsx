// FILE: account-research-ui/src/pages/LandingPage.tsx
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/button';
import {
  Rocket,
  History,
  Zap,
  Target,
  Languages,
  FileText,
  Lightbulb,
  BarChart,
  BrainCircuit,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// Animation variants
// -----------------------------------------------------------------------------
const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut', staggerChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function LandingPage() {
  // Respect user “Reduce Motion” setting
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* ---------------------------------------------------------------------
           Hero
      ---------------------------------------------------------------------- */}
      <section className="relative overflow-hidden min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center py-20 md:py-32 px-6">
        <motion.img
          src="/supervity_logo.png"
          alt="Supervity logo"
          loading="lazy"
          decoding="async"
          className="h-16 w-auto mb-8"
          initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
          animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
          transition={
            reduceMotion ? undefined : { delay: 0.1, type: 'spring', stiffness: 150 }
          }
        />

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-5 leading-tight max-w-3xl"
          initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { delay: 0.2, duration: 0.5 }}
        >
          Generate Comprehensive Account Research with{' '}
          <span className="text-lime">AI</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
          initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { delay: 0.3, duration: 0.5 }}
        >
          Get deep, multi‑lingual company insights powered by AI. Streamline your
          research process and close deals faster.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { delay: 0.4, duration: 0.5 }}
        >
          <Link to="/generate">
            <Button
              size="lg"
              variant="primary"
              className="font-semibold px-8 py-3 text-lg rounded-lg transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.98] flex items-center gap-2 shadow-lg hover:shadow-lime/30"
            >
              <Rocket className="w-5 h-5" />
              Start New Report
            </Button>
          </Link>

          <Link to="/history">
            <Button
              variant="secondary"
              size="lg"
              className="font-semibold px-8 py-3 text-lg rounded-lg transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.98] flex items-center gap-2"
            >
              <History className="w-5 h-5" />
              View History
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* ---------------------------------------------------------------------
           How It Works
      ---------------------------------------------------------------------- */}
      <motion.section
        className="relative overflow-hidden py-16 md:py-24 bg-navy px-6"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            How It Works
          </h2>
          <p className="text-lg text-gray-lt mb-12">
            Generate detailed reports in just a few simple steps.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Step 1 */}
            <motion.div
              className="flex flex-col items-center"
              variants={itemVariants}
            >
              <div className="bg-lime/10 border-2 border-lime rounded-full p-4 mb-4 inline-flex">
                <Target className="w-8 h-8 text-lime" aria-hidden />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                1. Define Target
              </h3>
              <p className="text-gray-lt text-sm">
                Enter the company name you want to research and provide your
                company context.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              className="flex flex-col items-center"
              variants={itemVariants}
            >
              <div className="bg-lime/10 border-2 border-lime rounded-full p-4 mb-4 inline-flex">
                <FileText className="w-8 h-8 text-lime" aria-hidden />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                2. Customize Report
              </h3>
              <p className="text-gray-lt text-sm">
                Select the desired language and specific sections you need for
                your report.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              className="flex flex-col items-center"
              variants={itemVariants}
            >
              <div className="bg-lime/10 border-2 border-lime rounded-full p-4 mb-4 inline-flex">
                <Zap className="w-8 h-8 text-lime" aria-hidden />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                3. AI Generation
              </h3>
              <p className="text-gray-lt text-sm">
                Our AI agent gathers data, analyzes insights, and compiles your
                comprehensive PDF report.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------------
           Key Features
      ---------------------------------------------------------------------- */}
      <motion.section
        className="relative overflow-hidden py-16 md:py-24 bg-background px-6"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-white">
            Key Features
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <Languages className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Multi‑Lingual
              </h3>
              <p className="text-muted-foreground text-sm">
                Generate reports in multiple languages (currently English & German)
                to match your target market.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <BrainCircuit className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                AI‑Powered Insights
              </h3>
              <p className="text-muted-foreground text-sm">
                Leverages advanced AI to extract and synthesize relevant
                information from various sources.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <FileText className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Comprehensive Sections
              </h3>
              <p className="text-muted-foreground text-sm">
                Covers key areas like company overview, financials, strategy,
                challenges, and more.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <BarChart className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Data‑Driven
              </h3>
              <p className="text-muted-foreground text-sm">
                Focuses on extracting factual data points and strategic
                information for better decision‑making.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <Lightbulb className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Strategic Relevance
              </h3>
              <p className="text-muted-foreground text-sm">
                Tailored insights considering your company's perspective for
                effective account planning.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div
              className="bg-card p-6 rounded-lg border border-border shadow-md"
              variants={itemVariants}
            >
              <Zap className="w-8 h-8 text-lime mb-3" aria-hidden />
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                Fast & Efficient
              </h3>
              <p className="text-muted-foreground text-sm">
                Automates the tedious research process, delivering reports in
                minutes, not hours.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------------
           Why Supervity
      ---------------------------------------------------------------------- */}
      <motion.section
        className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-br from-navy to-primary px-6"
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <img
            src="/supervity_logo.png"
            alt="Supervity logo"
            loading="lazy"
            decoding="async"
            className="h-12 w-auto mb-6 opacity-80"
          />

          <h2 className="text-3xl md:text-4xl font-bold mb-5 text-white">
            Why Choose Supervity?
          </h2>
          <p className="text-lg text-gray-lt mb-10">
            Supervity empowers sales and marketing teams with intelligent
            automation. Our Account Research AI Agent is designed to cut through
            the noise, providing actionable insights that drive meaningful
            conversations and accelerate your sales cycle. Focus on building
            relationships; let AI handle the research.
          </p>

          <Link to="/generate">
            <Button
              size="lg"
              variant="primary"
              className="font-semibold px-8 py-3 text-lg rounded-lg transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.98] flex items-center gap-2 shadow-lg hover:shadow-lime/40"
            >
              Generate Your First Report
              <Rocket className="w-5 h-5 ml-1" aria-hidden />
            </Button>
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
