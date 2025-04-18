// FILE: account-research-ui/src/contexts/WizardContext.tsx
import {
  createContext,
  useContext,
  ReactNode,
} from 'react';
import {
  useForm,
  UseFormReturn,
  Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

/* ---------------------------------------------------------------------- */
/* 1. Zod schema and type helpers                                         */
/* ---------------------------------------------------------------------- */

export const wizardFormSchema = z.object({
  targetCompany: z.string().min(2, { message: 'Target company name is required (min 2 chars).' }),
  userCompany: z.string().min(2, { message: 'Your company name is required (min 2 chars).' }),
  // Use string for language instead of enum since values are fetched dynamically
  language: z.string().min(1, { message: "Please select a valid language." }),
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
      language: '', // Default language is now set in OptionsStep useEffect
      sections: [], // Explicitly set default sections to empty array here
      targetCompany: '',
      userCompany: '',
      ...defaultValues, // Allow overriding defaults
    },
    mode: 'onChange', // Validate on change for better UX
  });

  return (
    <WizardContext.Provider
      value={{
        ...methods,
        currentStep,
        setCurrentStep,
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