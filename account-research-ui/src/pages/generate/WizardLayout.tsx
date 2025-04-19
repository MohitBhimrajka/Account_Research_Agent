// FILE: account-research-ui/src/pages/generate/WizardLayout.tsx
import { useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WizardProvider, type FormValues } from '../../contexts/WizardContext';
import { Stepper } from '../../components/ui/stepper';
import { Button } from '../../components/ui/button';
import { TargetCompanyStep } from './steps/TargetCompanyStep';
import { AboutYouStep } from './steps/AboutYouStep';
import api from '../../api/client';
import { useWizardForm } from '../../contexts/WizardContext';
import {
  Loader2,
  Send,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SubmitHandler } from 'react-hook-form';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

type LanguagesMap = Record<string, string>;

const steps = [
  {
    id: 'target',
    label: 'Target Company',
    fields: ['targetCompany'] as const,
  },
  {
    id: 'detailsAndOptions',
    label: 'Your Details & Report Options',
    fields: ['userCompany', 'language', 'sections'] as const,
  },
];

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 30 : -30,
    opacity: 0,
  }),
};

const stepTransition = {
  x: { type: 'tween', ease: 'easeOut', duration: 0.25 },
  opacity: { duration: 0.15 },
};

export default function WizardLayout() {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="min-h-[calc(100vh-10rem)] bg-background p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow-xl p-6 md:p-10 border border-border flex flex-col min-h-[600px]">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold text-card-foreground mb-6 text-center">
            Create New Account Research
          </h1>
          <Stepper
            steps={steps}
            activeStep={currentStep}
            className="mb-8 px-2"
          />
        </motion.div>

        <WizardProvider
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
        >
          <WizardForm />
        </WizardProvider>
      </div>
    </div>
  );
}

function WizardForm() {
  const navigate = useNavigate();
  const {
    handleSubmit,
    formState: { errors, isValid },
    trigger,
    currentStep,
    setCurrentStep,
  } = useWizardForm();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);

  const {
    data: availableLanguages,
    isLoading: isLoadingLanguages,
    error: languagesError,
  } = useQuery<LanguagesMap>({
    queryKey: ['languages'],
    queryFn: async () => {
      const r = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/languages`,
      );
      if (!r.ok) throw new Error('Failed to fetch languages for submission');
      return r.json();
    },
    staleTime: Infinity,
    enabled: !isSubmitting,
  });

  const stepComponents = [
    <TargetCompanyStep key="target" />,
    <AboutYouStep key="about" />,
  ];

  const hasCurrentErrors = steps[currentStep].fields.some(
    (f) => !!errors[f],
  );

  const handleNext = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    if (await trigger(steps[currentStep].fields)) {
      setDirection(1);
      setCurrentStep((p) => p + 1);
      setApiError(null);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((p) => p - 1);
      setApiError(null);
    }
  };

  const processFormSubmit: SubmitHandler<FormValues> = async (data) => {
    setApiError(null);
    setIsSubmitting(true);

    if (isLoadingLanguages) {
      const msg = 'Language configuration still loading, please wait…';
      setApiError(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }

    if (languagesError || !availableLanguages) {
      const msg = languagesError?.message || 'Failed to load language configuration.';
      setApiError(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }

    const languageKey = Object.entries(availableLanguages).find(
      ([, value]) => value === data.language,
    )?.[0];

    if (!languageKey) {
      const msg = 'Selected language is invalid or not configured.';
      setApiError(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        company_name: data.targetCompany,
        platform_company_name: data.userCompany,
        language_key: languageKey,
        sections: data.sections || [],
      };
      const { task_id } = await api.createTask(payload);
      toast.success('Task created successfully! Redirecting…');
      navigate(`/task/${task_id}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create task. Please try again.';
      setApiError(msg);
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(processFormSubmit)}
      className="flex flex-col flex-grow space-y-8"
    >
      {/* ↓ here’s the updated step container ↓ */}
      <div className="flex-grow overflow-auto p-2">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="relative w-full"
          >
            {stepComponents[currentStep]}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="bg-destructive/10 border-destructive border text-destructive p-3 rounded space-x-2 flex items-center"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{apiError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || isSubmitting}
          type="button"
          className="flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {currentStep === 0 ? (
          <Button
            variant="primary"
            type="button"
            onClick={handleNext}
            disabled={hasCurrentErrors || isSubmitting}
            className="flex items-center gap-1"
          >
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="primary"
            type="submit"
            disabled={!isValid || isSubmitting}
            className="flex items-center gap-1 min-w-[130px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Generate Report <Send className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
