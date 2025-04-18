// FILE: account-research-ui/src/contexts/WizardContext.tsx
import {
  createContext,
  useContext,
  ReactNode,
  FormEvent,
  useCallback,
} from 'react';
import {
  useForm,
  UseFormReturn,
  FieldValues,
  SubmitHandler,
  Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AVAILABLE_LANGUAGES } from '../config'; // Import from frontend config
/* ---------------------------------------------------------------------- */
/* 1. Zod schema and type helpers                                         */
/* ---------------------------------------------------------------------- */

// Generate language enum from config
const languageKeys = Object.keys(AVAILABLE_LANGUAGES) as [string, ...string[]]; // Ensure at least one key
const languageValues = Object.values(AVAILABLE_LANGUAGES) as [string, ...string[]];

export const wizardFormSchema = z.object({
  targetCompany: z.string().min(2, { message: 'Target company name is required (min 2 chars).' }),
  userCompany: z.string().min(2, { message: 'Your company name is required (min 2 chars).' }),
  // Use language *values* from backend config for the enum
  language: z.enum(languageValues, {
      errorMap: () => ({ message: "Please select a valid language." }),
  }),
  // Array of section IDs (strings from backend config)
  sections: z.array(z.string()).default([]),
});

export type FormValues = {
  targetCompany: string;
  userCompany: string;
  language: string;
  sections: string[];
};

/* ---------------------------------------------------------------------- */
/* 2. Context definition                                                  */
/* ---------------------------------------------------------------------- */

type WizardContextType = UseFormReturn<FormValues> & {
  currentStep: number;
  setCurrentStep: (step: number | ((prevStep: number) => number)) => void; // Allow functional updates

  /**
   * Utility that wraps `handleSubmit` and swallows the native
   * event so you can write:
   *
   *   <form onSubmit={onSubmit(async (data) => { … })}>
   */
  onSubmit: (
    handler: SubmitHandler<FormValues>
  ) => (e?: FormEvent<HTMLFormElement>) => Promise<void>; // Make event optional
};

const WizardContext = createContext<WizardContextType | null>(null);

/* ---------------------------------------------------------------------- */
/* 3. Provider                                                            */
/* ---------------------------------------------------------------------- */

interface WizardProviderProps {
  children: ReactNode;
  /** external step state lives in WizardLayout */
  currentStep: number;
  setCurrentStep: (s: number | ((prevStep: number) => number)) => void;
  /** for SSR / unit‑tests you can override defaults */
  defaultValues?: Partial<FormValues>;
}

export function WizardProvider({
  children,
  currentStep,
  setCurrentStep,
  defaultValues,
}: WizardProviderProps) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(wizardFormSchema) as Resolver<FormValues>,
    defaultValues: {
      language: AVAILABLE_LANGUAGES['2'], // Default to English value
      sections: [] as string[],
      targetCompany: '',
      userCompany: '',
    },
    mode: 'onChange', // Validate on change for better UX
  });

  /** helper that returns a submit handler you can drop into `<form onSubmit={...}>` */
  const onSubmit: WizardContextType['onSubmit'] = useCallback(
    (handler) => async (e) => {
      if (e) {
          e.preventDefault(); // Prevent default form submission
          e.stopPropagation(); // Stop event bubbling
      }
      // Trigger validation before submitting
      const isValid = await methods.trigger();
      if (isValid) {
          // Directly call the handler with form data
          await handler(methods.getValues());
      } else {
          console.log("Form validation failed", methods.formState.errors);
      }
    },
    [methods]
  );


  return (
    <WizardContext.Provider
      value={{
        ...methods,
        currentStep,
        setCurrentStep,
        onSubmit,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

/* ---------------------------------------------------------------------- */
/* 4. Hook                                                                */
/* ---------------------------------------------------------------------- */

export function useWizardForm() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizardForm must be used inside WizardProvider');
  return ctx;
}