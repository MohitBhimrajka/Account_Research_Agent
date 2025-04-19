// FILE: account-research-ui/src/pages/generate/WizardLayout.tsx
import { useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // Import motion
import { WizardProvider, type FormValues } from '../../contexts/WizardContext';
import { Stepper } from '../../components/ui/stepper';
import { Button } from '../../components/ui/button';
import { TargetCompanyStep } from './steps/TargetCompanyStep';
import { AboutYouStep } from './steps/AboutYouStep'; // Will become the combined step
import api from '../../api/client';
import { useWizardForm } from '../../contexts/WizardContext';
import { Loader2, Send, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'; // Import icons
import { useQuery } from '@tanstack/react-query';
import { SubmitHandler } from 'react-hook-form'; // Import SubmitHandler
import { cn } from '../../lib/utils'; // Ensure cn is imported

// Define the type for the languages map from the API
type LanguagesMap = Record<string, string>;

// Define steps in the desired order
const steps = [
  { id: 'target', label: 'Target Company', fields: ['targetCompany'] as const },
  { id: 'detailsAndOptions', label: 'Your Details & Report Options', fields: ['userCompany', 'language', 'sections'] as const }, // Combined step
];

// Animation variants for steps
const stepVariants = {
  enter: (direction: number) => ({ // Direction: 1 for next, -1 for back
    x: direction > 0 ? 30 : -30, // Start slightly off-screen
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 30 : -30, // Exit slightly off-screen
    opacity: 0,
  }),
};

const stepTransition = {
  x: { type: "tween", ease: "easeInOut", duration: 0.3 },
  opacity: { duration: 0.2 }
};

// Internal component with access to form context
function WizardForm() {
  const navigate = useNavigate();
  const {
    handleSubmit, // USE THIS FROM RHF
    formState: { errors, isValid }, // Get form-wide validity
    trigger,
    currentStep,
    setCurrentStep,
  } = useWizardForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [direction, setDirection] = useState(1); // 1 for next, -1 for back

  // Fetch languages data using useQuery
  const { data: availableLanguages, isLoading: isLoadingLanguages, error: languagesError } = useQuery<LanguagesMap>({
    queryKey: ['languages'],
    queryFn: async () => {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/languages`);
        if (!response.ok) throw new Error('Failed to fetch languages for submission');
        return response.json();
    },
    staleTime: Infinity,
    enabled: !isSubmitting, // Only fetch if not already submitting
  });
  
  const handleNext = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    console.log(`--- handleNext called (Going from Step ${currentStep} to ${currentStep + 1}) ---`);
    const fieldsToValidate = steps[currentStep].fields; // Should be ['targetCompany'] when currentStep is 0
    console.log(`Fields to validate for step ${currentStep}:`, fieldsToValidate);

    const isValidStep = await trigger(fieldsToValidate);
    console.log(`Validation result for step ${currentStep}: ${isValidStep}`);

    const shouldAdvance = currentStep < steps.length - 1; // Will be true only if currentStep is 0
    console.log(`Should advance? (${currentStep} < ${steps.length - 1}): ${shouldAdvance}`);

    if (isValidStep && shouldAdvance) {
      console.log(`Validation passed and not last step. Calling setCurrentStep.`);
      setDirection(1); // Set direction before state change
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        console.log(`Inside setCurrentStep: Advancing from ${prev} to ${nextStep}`);
        return nextStep; // Advances to step index 1
      });
      if (apiError) setApiError(null);
    } else if (!isValidStep) {
      console.log(`Validation FAILED for step ${currentStep}. Errors:`, JSON.stringify(errors));
    } else {
      console.log(`Condition not met to advance (Already last step or validation failed).`);
    }
    console.log(`--- handleNext finished ---`);
  };

  const handleBack = () => {
    console.log("--- handleBack called ---");
    if (currentStep > 0) {
      setDirection(-1); // Set direction before state change
      setCurrentStep(prev => prev - 1); // Moves back to step index 0
      if (apiError) setApiError(null);
    }
  };

  // This function is PASSED TO RHF's handleSubmit. It receives validated form data.
  const processFormSubmit: SubmitHandler<FormValues> = async (data) => {
    console.log(`--- processFormSubmit called (FINAL SUBMISSION from Step ${currentStep}) ---`);
    console.log("Data received by submit handler:", data);
    setApiError(null);
    setIsSubmitting(true);

    // Wait if languages are still loading for the lookup
    if (isLoadingLanguages) {
        console.log('processFormSubmit: Waiting for languages map...');
        setApiError("Language configuration still loading, please wait...");
        setIsSubmitting(false);
        return;
    }

    if (languagesError || !availableLanguages) {
      console.error('processFormSubmit: Language fetch error or data missing.');
      setApiError(`Failed to load language configuration: ${languagesError?.message || 'Unknown error'}`);
      setIsSubmitting(false);
      return;
    }

    // Find the language key corresponding to the selected language value
    const languageKey = Object.entries(availableLanguages).find(
      ([_, value]) => value === data.language
    )?.[0];

    if (!languageKey) {
        console.error('processFormSubmit: Could not find language key for:', data.language);
        setApiError("Selected language is invalid or not configured properly.");
        setIsSubmitting(false);
        return;
    }

    try {
      const payload = {
          company_name: data.targetCompany,
          platform_company_name: data.userCompany,
          language_key: languageKey,
          sections: data.sections || [] // Ensure sections is always an array
      };
      console.log('processFormSubmit: Sending API Payload:', payload);
      const { task_id } = await api.createTask(payload);
      console.log('processFormSubmit: Task created with ID:', task_id);
      console.log(`processFormSubmit: Navigating to /task/${task_id}`);
      navigate(`/task/${task_id}`);

    } catch (error: any) {
      console.error('processFormSubmit: Error creating task:', error);
      setApiError(
        error.response?.data?.detail ||
        error.message ||
        'Failed to create task. Please try again.'
      );
      setIsSubmitting(false); // Reset submitting state on error
    }
    console.log(`--- processFormSubmit finished ---`);
  };

  // Render step components based on the current step index
  const stepComponents = [
    <TargetCompanyStep key="target" />,
    <AboutYouStep key="about" />, // This component will be updated next
  ];

  // Determine if the current step has validation errors
  const hasCurrentStepErrors = steps[currentStep].fields.some(field => !!errors[field]);

  console.log(`WizardForm Rendering: currentStep=${currentStep}, isValid=${isValid}, hasCurrentStepErrors=${hasCurrentStepErrors}, isSubmitting=${isSubmitting}`);
  
  return (
    // Use RHF's handleSubmit to wrap the actual submission logic
    <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-8 flex flex-col flex-grow">
      {/* Animated Step Area */}
      <div className="min-h-[300px] p-1 overflow-hidden relative flex-grow"> {/* Ensure overflow is hidden and container is relative */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep} // Key changes, triggering animation
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
            className="absolute w-full" // Position absolute for smooth transition
          >
            {stepComponents[currentStep]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* API Error Display */}
      <AnimatePresence>
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="bg-destructive/10 border border-destructive text-destructive-foreground p-3 rounded-md text-sm flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0"/>
            <span>{apiError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-border mt-auto"> {/* mt-auto pushes buttons down */}
        <Button
          variant="outline"
          onClick={handleBack} // Calls local handleBack
          disabled={currentStep === 0 || isSubmitting} // Only disable Back on Step 0
          type="button" // MUST be type="button" to not submit form
          className="flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Show NEXT button only on Step 0 */}
        {currentStep === 0 ? (
          <Button
            variant="primary"
            type="button"
            onClick={handleNext}
            disabled={hasCurrentStepErrors || isSubmitting} // Disable based on Step 0 errors
            className="flex items-center gap-1"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          // Show SUBMIT button on Step 1 (the new final step)
          <Button
            variant="primary"
            type="submit" // MUST be type="submit" to trigger the form's onSubmit
            disabled={!isValid || isSubmitting} // Disable based on overall form validity
            className="flex items-center gap-1 min-w-[130px]" // Min width to prevent layout shift
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                Generate Report <Send className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

// Main layout component
export default function WizardLayout() {
  const [currentStep, setCurrentStep] = useState(0);
  // console.log(`WizardLayout (Parent): Rendering with currentStep = ${currentStep}`);
  
  return (
    <div className="min-h-[calc(100vh-10rem)] bg-background p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-card rounded-2xl shadow-xl p-6 md:p-10 border border-border flex flex-col min-h-[600px]"> {/* Ensure card has min-height */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="text-3xl font-bold text-card-foreground mb-6 text-center">Create New Account Research</h1>
          <Stepper
            steps={steps}
            activeStep={currentStep}
            className="mb-8 px-2"
          />
        </motion.div>

        <WizardProvider currentStep={currentStep} setCurrentStep={setCurrentStep}>
          {/* WizardForm now handles its own flex-grow */}
          <WizardForm />
        </WizardProvider>
      </div>
    </div>
  );
}