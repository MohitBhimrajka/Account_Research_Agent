// FILE: account-research-ui/src/pages/generate/WizardLayout.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WizardProvider, type FormValues } from '../../contexts/WizardContext';
import { Stepper } from '../../components/ui/stepper';
import { Button } from '../../components/ui/button';
import { TargetCompanyStep } from './steps/TargetCompanyStep';
import { AboutYouStep } from './steps/AboutYouStep';
import { OptionsStep } from './steps/OptionsStep';
import api from '../../api/client';
import { useWizardForm } from '../../contexts/WizardContext';
import { Loader2, Send, ArrowLeft, ArrowRight } from 'lucide-react'; // Import icons
import { useQuery } from '@tanstack/react-query';

// Define the type for the languages map from the API
type LanguagesMap = Record<string, string>;

// Define steps in the desired order
const steps = [
  { id: 'target', label: 'Target Company', fields: ['targetCompany'] as const },
  { id: 'about', label: 'Your Company', fields: ['userCompany'] as const },
  { id: 'options', label: 'Language & Options', fields: ['language', 'sections'] as const },
];

// Internal component with access to form context
function WizardForm() {
  const navigate = useNavigate();
  const {
    handleSubmit, // Use handleSubmit directly from react-hook-form
    formState: { errors, isValid, touchedFields, isDirty },
    getValues,
    trigger,
    currentStep,
    setCurrentStep
  } = useWizardForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch languages data using useQuery
  const { data: availableLanguages, isLoading: isLoadingLanguages, error: languagesError } = useQuery<LanguagesMap>({
    queryKey: ['languages'], // Use the same query key to potentially hit cache
    queryFn: async () => {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/languages`);
        if (!response.ok) throw new Error('Failed to fetch languages for submission');
        return response.json();
    },
    staleTime: Infinity,
    enabled: !isSubmitting, // Only fetch if not already submitting
  });
  
  const handleNext = async () => {
    // Trigger validation for the current step's fields
    const fieldsToValidate = steps[currentStep].fields;
    const isValidStep = await trigger(fieldsToValidate);

    if (isValidStep && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      // Clear any previous API errors when moving to next step
      if (apiError) setApiError(null);
    } else {
      // Optionally show validation errors if needed, though react-hook-form usually handles this
      console.log("Validation failed for step", currentStep, errors);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      // Clear any previous API errors when moving back
      if (apiError) setApiError(null);
    }
  };

  // This is the actual function passed to RHF's handleSubmit
  const processFormSubmit = async (data: FormValues) => {
    setApiError(null);
    setIsSubmitting(true);
    console.log('Submitting data:', data);

    // Wait if languages are still loading for the lookup
    if (isLoadingLanguages) {
        console.log('Waiting for languages map to load...');
        setApiError("Language configuration still loading, please wait...");
        setIsSubmitting(false);
        return; // Or potentially add a short delay/retry?
    }

    if (languagesError || !availableLanguages) {
      setApiError(`Failed to load language configuration: ${languagesError?.message || 'Unknown error'}`);
      setIsSubmitting(false);
      return;
    }

    // Find the language key corresponding to the selected language value
    const languageKey = Object.entries(availableLanguages).find(
      ([_, value]) => value === data.language
    )?.[0];

    if (!languageKey) {
        setApiError("Selected language is invalid or not configured properly.");
        setIsSubmitting(false);
        return;
    }

    try {
      const payload = {
          company_name: data.targetCompany,
          platform_company_name: data.userCompany,
          language_key: languageKey,
          sections: data.sections || []
      };
      console.log('API Payload:', payload);
      const { task_id } = await api.createTask(payload);
      console.log('Task created with ID:', task_id);
      navigate(`/task/${task_id}`);
    } catch (error: any) {
      console.error('Error creating task:', error);
      setApiError(
        error.response?.data?.detail ||
        error.message ||
        'Failed to create task. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  // Render step components based on the current step index
  const stepComponents = [
    <TargetCompanyStep key="target" />,
    <AboutYouStep key="about" />,
    <OptionsStep key="options" />,
  ];

  // Determine if the current step has validation errors
  const hasCurrentStepErrors = steps[currentStep].fields.some(field => !!errors[field]);

  // Determine if the current step is valid
  const isCurrentStepValid = () => {
    const currentFields = steps[currentStep].fields;
    // Check if all fields in the current step have been touched and have no errors
    return currentFields.every(field => touchedFields[field] && !errors[field]);
  };

  return (
    // Use RHF's handleSubmit to wrap the actual submission logic
    <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-8">
      <div className="min-h-[250px] p-1"> {/* Added padding */}
        {stepComponents[currentStep]}
      </div>

      {apiError && (
        <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-md text-sm">
          {apiError}
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0 || isSubmitting}
          type="button"
          className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            variant="primary" // Use accent color for Next
            type="button"
            onClick={handleNext}
            // Disable if current step fields have errors or is submitting
            disabled={hasCurrentStepErrors || isSubmitting}
            className="bg-lime text-primary hover:bg-lime/90 flex items-center gap-1"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="primary" // Use accent color for Submit
            type="submit"
            // Disable if form is invalid or submitting
            disabled={!isValid || isSubmitting}
            className="bg-lime text-primary hover:bg-lime/90 flex items-center gap-1"
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-primary p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl bg-navy rounded-2xl shadow-xl p-6 md:p-10"> {/* Increased padding */}
        <h1 className="text-3xl font-bold text-white mb-8 text-center">Create New Account Research</h1>

        <Stepper
          steps={steps}
          activeStep={currentStep}
          className="mb-10 px-2" // Added padding
        />

        <WizardProvider currentStep={currentStep} setCurrentStep={setCurrentStep}>
          <WizardForm />
        </WizardProvider>
      </div>
    </div>
  );
}