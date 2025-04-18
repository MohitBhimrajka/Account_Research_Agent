// FILE: account-research-ui/src/pages/generate/steps/TargetCompanyStep.tsx
import { useWizardForm } from '../../../contexts/WizardContext';
import { Building } from 'lucide-react';

export function TargetCompanyStep() {
  const { register, formState: { errors } } = useWizardForm();

  return (
    <div className="space-y-4 animate-fadeIn"> {/* Add animation */}
      <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
        <Building className="text-lime w-5 h-5" />
        Step 1: Target Company
      </h2>
      <p className="text-gray-lt text-sm mb-4">
        Enter the name of the company you want to research. This is the primary subject of the report.
      </p>
      <div>
        <label htmlFor="targetCompany" className="block text-sm font-medium text-gray-lt mb-1 sr-only"> {/* Screen reader only */}
          Target Company Name
        </label>
        <input
          id="targetCompany"
          type="text"
          className="w-full p-3 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base" /* Adjusted styles */
          placeholder="e.g., Acme Corporation"
          {...register("targetCompany")}
          aria-invalid={errors.targetCompany ? "true" : "false"}
          aria-describedby="targetCompanyError"
        />
        {errors.targetCompany && (
          <p id="targetCompanyError" className="text-orange text-xs mt-1 px-1">{errors.targetCompany.message}</p>
        )}
      </div>
    </div>
  );
}