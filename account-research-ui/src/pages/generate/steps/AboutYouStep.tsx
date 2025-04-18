// FILE: account-research-ui/src/pages/generate/steps/AboutYouStep.tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWizardForm } from '../../../contexts/WizardContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { User, Globe, Settings, ChevronsUpDown, Loader2, AlertCircle } from 'lucide-react';

// Define types
type LanguagesMap = Record<string, string>;
type SectionInfo = { id: string; title: string };

export function AboutYouStep() {
  // Get necessary methods/state from wizard context
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const selectedSections = watch("sections", []); // Watch selected sections

  // --- Fetch Languages ---
  const { data: availableLanguages, isLoading: isLoadingLanguages, error: languagesError } = useQuery<LanguagesMap>({
    queryKey: ['languages'],
    queryFn: async () => {
        // Use fetch directly as API client might not be needed just for GET
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/languages`);
        if (!response.ok) throw new Error('Failed to fetch languages');
        return response.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // --- Fetch Sections ---
  const { data: availableSections, isLoading: isLoadingSections, error: sectionsError } = useQuery<SectionInfo[]>({
     queryKey: ['sections'],
     queryFn: async () => {
         const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/sections`);
         if (!response.ok) throw new Error('Failed to fetch sections');
         const data = await response.json();
          // Add validation/logging here if needed
         console.log("Fetched sections data:", data);
         if (!Array.isArray(data)) {
             console.error("Fetched sections data is not an array:", data);
             throw new Error("Invalid format for sections data");
         }
         return data;
     },
     staleTime: Infinity,
     refetchOnWindowFocus: false,
  });

 // --- Set Default Language and Sections ---
 useEffect(() => {
    // Set default language to English value if available and not already set
    if (availableLanguages && !watch('language')) {
        const englishValue = availableLanguages['2']; // Assuming '2' key corresponds to 'English'
        if (englishValue) {
            console.log("Setting default language to:", englishValue);
            setValue('language', englishValue, { shouldValidate: true });
        } else {
            console.warn("Could not find English language value with key '2'.");
            // Optionally set to the first available language as a fallback
            const firstLangValue = Object.values(availableLanguages)[0];
            if (firstLangValue) {
                setValue('language', firstLangValue, { shouldValidate: true });
            }
        }
    }
    // Set default sections once fetched and if none are selected yet
    if (availableSections && Array.isArray(availableSections) && selectedSections.length === 0) {
         const defaultSectionIds = availableSections.map(s => s.id);
         console.log('Setting default sections:', defaultSectionIds);
         setValue("sections", defaultSectionIds, { shouldValidate: true });
    }
 }, [availableLanguages, availableSections, selectedSections.length, setValue, watch]); // Depend on lengths/existence

  // --- Event Handlers ---
  const handleSectionToggle = (sectionId: string) => {
    const currentSections = selectedSections || [];
    const updatedSections = currentSections.includes(sectionId)
      ? currentSections.filter(id => id !== sectionId)
      : [...currentSections, sectionId];
    // Update form state
    setValue("sections", updatedSections, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  const areAllSectionsSelected = availableSections && Array.isArray(availableSections) && selectedSections?.length === availableSections.length;

  const handleToggleAllSections = () => {
    if (!availableSections || !Array.isArray(availableSections)) return;
    if (areAllSectionsSelected) {
      setValue("sections", [], { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } else {
      setValue("sections", availableSections.map(s => s.id), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6 animate-fadeIn"> {/* Increased spacing */}
       <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
         <User className="text-lime w-5 h-5" />
         Step 2: Your Details & Report Options
      </h2>

      {/* --- Your Company Section --- */}
      <div>
          <p className="text-gray-lt text-sm mb-2">
            Tell us your company name. This helps tailor strategic insights.
          </p>
          <div>
            <label htmlFor="userCompany" className="block text-sm font-medium text-gray-lt mb-1 sr-only">
              Your Company Name
            </label>
            <input
              id="userCompany"
              type="text"
              className="w-full p-3 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base"
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

      {/* --- Divider --- */}
      <div className="mt-8 pt-6 border-t border-border/50">
        <h3 className="text-lg font-semibold text-white mb-4">Report Customization</h3>

        {/* --- Loading / Error State for Options --- */}
        {(isLoadingLanguages || isLoadingSections) && (
           <div className="flex justify-center items-center min-h-[100px]">
               <Loader2 className="w-6 h-6 animate-spin text-lime" />
               <span className="ml-2 text-gray-lt">Loading options...</span>
           </div>
        )}
        {(languagesError || sectionsError) && (
             <div className="text-center text-orange bg-destructive/10 p-4 rounded border border-destructive">
                 <AlertCircle className="w-6 h-6 mx-auto mb-2"/>
                 <p>Error loading report options:</p>
                 <p className="text-sm">{languagesError?.message || sectionsError?.message}</p>
             </div>
        )}

        {/* --- Options Content (only render if loaded without errors) --- */}
        {!isLoadingLanguages && !isLoadingSections && !languagesError && !sectionsError && availableLanguages && availableSections && (
           <div className="space-y-6">
              {/* Language Selection */}
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-lt mb-2 flex items-center gap-1">
                  <Globe className="w-4 h-4" /> Report Language
                </label>
                <div className="relative">
                    <select
                    id="language"
                    className="appearance-none w-full p-3 rounded-md border border-input bg-primary text-white focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base pr-8"
                    {...register("language")}
                    aria-invalid={errors.language ? "true" : "false"}
                    aria-describedby="languageError"
                    >
                      {/* Render options from fetched data */}
                      {Object.entries(availableLanguages).map(([key, value]) => (
                        <option key={key} value={value}>{value}</option>
                      ))}
                    </select>
                    <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-lt pointer-events-none" />
                </div>
                {errors.language && (
                  <p id="languageError" className="text-orange text-xs mt-1 px-1">{typeof errors.language.message === 'string' ? errors.language.message : 'Please select a language.'}</p>
                )}
              </div>

              {/* Sections Selection */}
              <Accordion type="single" collapsible className="w-full border border-input rounded-md overflow-hidden">
                <AccordionItem value="sections" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 text-white hover:bg-navy/50 hover:no-underline font-medium text-base data-[state=open]:bg-navy/50 data-[state=open]:border-b border-input flex items-center gap-1">
                     <Settings className="w-4 h-4"/> Select Report Sections (Optional)
                  </AccordionTrigger>
                  <AccordionContent className="p-4 bg-primary">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-gray-lt text-sm">Defaults to all sections if none are selected.</p>
                        <Button
                          type="button" // Important: keep as button
                          variant="link"
                          size="sm"
                          className="text-blue hover:text-lime px-1 h-auto py-0"
                          onClick={handleToggleAllSections}
                          disabled={!availableSections || !Array.isArray(availableSections)}
                        >
                          {areAllSectionsSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-h-60 overflow-y-auto pr-2">
                        {/* Ensure availableSections is an array before mapping */}
                        {Array.isArray(availableSections) && availableSections.map((section) => (
                          <div key={section.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`section-${section.id}`}
                              checked={selectedSections?.includes(section.id)}
                              onCheckedChange={() => handleSectionToggle(section.id)}
                              className="border-gray-lt data-[state=checked]:bg-lime data-[state=checked]:border-lime"
                            />
                            <label
                              htmlFor={`section-${section.id}`}
                              className="text-sm font-medium leading-none text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                            >
                              {section.title}
                            </label>
                          </div>
                        ))}
                      </div>
                      {/* Display general form error for sections if needed, though less likely for array validation */}
                       {errors.sections && typeof errors.sections.message === 'string' && (
                         <p className="text-orange text-xs mt-1 px-1">{errors.sections.message}</p>
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div> // End Options Content div
        )}
      </div> {/* End Divider div */}
    </div> // End main div
  );
}