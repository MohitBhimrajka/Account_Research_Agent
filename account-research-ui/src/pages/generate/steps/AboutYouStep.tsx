// FILE: account-research-ui/src/pages/generate/steps/AboutYouStep.tsx
import { WizardProvider, type FormValues, useWizardForm } from '../../../contexts/WizardContext';
import { User } from 'lucide-react';

export function AboutYouStep() {
  const { register, formState: { errors } } = useWizardForm();

  return (
    <div className="space-y-4 animate-fadeIn"> {/* Add animation */}
       <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
         <User className="text-lime w-5 h-5" />
         Step 2: Your Company
      </h2>
      <p className="text-gray-lt text-sm mb-4">
        Tell us your company name. This helps the AI tailor the strategic insights and competitive analysis in the report.
      </p>
      <div>
        <label htmlFor="userCompany" className="block text-sm font-medium text-gray-lt mb-1 sr-only"> {/* Screen reader only */}
          Your Company Name
        </label>
        <input
          id="userCompany"
          type="text"
          className="w-full p-3 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base" /* Adjusted styles */
          placeholder="e.g., Supervity Inc."
          {...register("userCompany")}
          aria-invalid={errors.userCompany ? "true" : "false"}
          aria-describedby="userCompanyError"
        />
        {errors.userCompany && (
          <p id="userCompanyError" className="text-orange text-xs mt-1 px-1">{errors.userCompany.message}</p>
        )}
      </div>
    </div>
  );
}