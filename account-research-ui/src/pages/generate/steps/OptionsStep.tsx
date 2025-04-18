// FILE: account-research-ui/src/pages/generate/steps/OptionsStep.tsx
import { WizardProvider, type FormValues, useWizardForm } from '../../../contexts/WizardContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { Globe, Settings, ChevronsUpDown } from 'lucide-react'; // Import icons
import { AVAILABLE_LANGUAGES, PROMPT_FUNCTIONS } from '../../../config'; // Import frontend config

// Map backend section IDs and titles
const AVAILABLE_SECTIONS = PROMPT_FUNCTIONS.map(([id, _, title]) => ({ // Use title from config if available, otherwise format ID
  id: id,
  label: title || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}));


export function OptionsStep() {
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const selectedSections = watch("sections", []); // Default to empty array

  const handleSectionToggle = (sectionId: string) => {
    const currentSections = selectedSections || [];
    const updatedSections = currentSections.includes(sectionId)
      ? currentSections.filter(id => id !== sectionId)
      : [...currentSections, sectionId];

    setValue("sections", updatedSections, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  // Check if all sections are selected
  const areAllSectionsSelected = selectedSections?.length === AVAILABLE_SECTIONS.length;

  // Toggle all sections
  const handleToggleAllSections = () => {
    if (areAllSectionsSelected) {
      setValue("sections", [], { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } else {
      setValue("sections", AVAILABLE_SECTIONS.map(s => s.id), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  };


  return (
    <div className="space-y-6 animate-fadeIn"> {/* Add animation */}
       <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
         <Settings className="text-lime w-5 h-5" />
         Step 3: Report Options
      </h2>

      {/* Language Selection */}
      <div>
        <label htmlFor="language" className="block text-sm font-medium text-gray-lt mb-1 flex items-center gap-1">
          <Globe className="w-4 h-4" /> Report Language
        </label>
        <div className="relative">
            <select
            id="language"
            className="appearance-none w-full p-3 rounded-md border border-input bg-primary text-white focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base pr-8" /* Adjusted styles */
            {...register("language")}
            aria-invalid={errors.language ? "true" : "false"}
            aria-describedby="languageError"
            >
            {Object.entries(AVAILABLE_LANGUAGES).map(([key, value]) => (
                <option key={key} value={value}>{value}</option>
            ))}
            </select>
            <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-lt pointer-events-none" />
        </div>
        {errors.language && (
          <p id="languageError" className="text-orange text-xs mt-1 px-1">{errors.language.message}</p>
        )}
      </div>

      {/* Advanced Options Accordion */}
      <Accordion type="single" collapsible className="w-full border border-input rounded-md overflow-hidden">
        <AccordionItem value="advanced" className="border-b-0"> {/* Remove bottom border */}
          <AccordionTrigger className="px-4 py-3 text-white hover:bg-navy/50 hover:no-underline font-medium text-base data-[state=open]:bg-navy/50 data-[state=open]:border-b border-input"> {/* Adjusted styles */}
            Advanced: Select Report Sections
          </AccordionTrigger>
          <AccordionContent className="p-4 bg-primary"> {/* Ensure content background matches */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-lt text-sm">Choose which sections to include (Default: All)</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-blue hover:text-lime px-1 h-auto py-0"
                  onClick={handleToggleAllSections}
                >
                  {areAllSectionsSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-h-60 overflow-y-auto pr-2"> {/* Scrollable section list */}
                {AVAILABLE_SECTIONS.map((section) => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={section.id}
                      checked={selectedSections?.includes(section.id)}
                      onCheckedChange={() => handleSectionToggle(section.id)}
                      className="border-gray-lt data-[state=checked]:bg-lime data-[state=checked]:border-lime"
                    />
                    <label
                      htmlFor={section.id}
                      className="text-sm font-medium leading-none text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {section.label}
                    </label>
                  </div>
                ))}
              </div>
              {errors.sections && (
                 <p className="text-orange text-xs mt-1 px-1">{errors.sections.message}</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}