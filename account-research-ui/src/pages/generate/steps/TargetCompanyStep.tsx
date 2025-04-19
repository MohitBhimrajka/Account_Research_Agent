// FILE: account-research-ui/src/pages/generate/steps/TargetCompanyStep.tsx
import { useWizardForm } from '../../../contexts/WizardContext';
import { Building } from 'lucide-react';

export function TargetCompanyStep() {
  const { register, formState: { errors } } = useWizardForm();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-card-foreground mb-1 flex items-center gap-2">
        <Building className="text-lime w-5 h-5" />
        Step 1: Target Company
      </h2>
      <p className="text-muted-foreground text-sm mb-4">
        Enter the name of the company you want to research. This is the primary subject of the report.
      </p>
      <div>
        <label htmlFor="targetCompany" className="block text-sm font-medium text-muted-foreground mb-1 sr-only">
          Target Company Name
        </label>
        <input
          id="targetCompany"
          type="text"
          className="w-full p-3 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:border-accent focus:ring-1 focus:ring-ring text-base"
          placeholder="e.g., Acme Corporation"
          {...register("targetCompany")}
          aria-invalid={errors.targetCompany ? "true" : "false"}
          aria-describedby="targetCompanyError"
        />
        {errors.targetCompany && (
          <p id="targetCompanyError" className="text-destructive text-xs mt-1 px-1">{errors.targetCompany.message}</p>
        )}
      </div>
    </div>
  );
}