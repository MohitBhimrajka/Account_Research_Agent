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
  } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import * as z from 'zod';
  
  /* ---------------------------------------------------------------------- */
  /* 1. Zod schema and type helpers                                         */
  /* ---------------------------------------------------------------------- */
  
  export const wizardFormSchema = z.object({
    targetCompany: z.string().min(2, 'Target company is required'),
    userCompany: z.string().min(2, 'Your company name is required'),
    language: z.enum([
      'English',
      'Japanese',
      'Spanish',
      'French',
      'German',
      'Chinese',
      'Portuguese',
      'Italian',
      'Russian',
      'Korean',
    ]),
    /** Array of section‑IDs – hidden in “advanced” UI */
    sections: z.array(z.string()).default([]),
  });
  
  export type FormValues = z.infer<typeof wizardFormSchema>;
  
  /* ---------------------------------------------------------------------- */
  /* 2. Context definition                                                  */
  /* ---------------------------------------------------------------------- */
  
  type WizardContextType = UseFormReturn<FormValues> & {
    currentStep: number;
    setCurrentStep: (step: number) => void;
  
    /**
     * Utility that wraps `handleSubmit` and swallows the native
     * event so you can write:
     *
     *   <form onSubmit={onSubmit(async (data) => { … })}>
     */
    onSubmit: (
      handler: SubmitHandler<FormValues>
    ) => (e: FormEvent<HTMLFormElement>) => Promise<void>;
  };
  
  const WizardContext = createContext<WizardContextType | null>(null);
  
  /* ---------------------------------------------------------------------- */
  /* 3. Provider                                                            */
  /* ---------------------------------------------------------------------- */
  
  interface WizardProviderProps {
    children: ReactNode;
    /** external step state lives in WizardLayout */
    currentStep: number;
    setCurrentStep: (s: number) => void;
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
      resolver: zodResolver(wizardFormSchema),
      defaultValues: {
        language: 'English',
        sections: [],
        ...defaultValues,
      },
      mode: 'onChange',
    });
  
    /** helper that returns a submit handler you can drop into `<form>` */
    const onSubmit: WizardContextType['onSubmit'] = useCallback(
      (handler) => async (e) => {
        e.preventDefault();
        await methods.handleSubmit(handler as SubmitHandler<FieldValues>)(e);
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
  