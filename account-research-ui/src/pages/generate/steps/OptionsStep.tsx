// FILE: account-research-ui/src/pages/generate/steps/OptionsStep.tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWizardForm } from '../../../contexts/WizardContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { Globe, Settings, ChevronsUpDown, Loader2, AlertCircle } from 'lucide-react';
import api from '../../../api/client'; // Use the correct API client

// Define types for fetched data
type LanguagesMap = Record<string, string>;
type SectionInfo = { id: string; title: string };

export function OptionsStep() {
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const selectedSections = watch("sections", []);

  // --- Fetch Languages ---
  const { data: availableLanguages, isLoading: isLoadingLanguages, error: languagesError } = useQuery<LanguagesMap>({
    queryKey: ['languages'],
    queryFn: async () => {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/languages`);
        if (!response.ok) throw new Error('Failed to fetch languages');
        return response.json();
    },
    staleTime: Infinity, // Cache indefinitely
    refetchOnWindowFocus: false,
  });

  // --- Fetch Sections ---
  const { data: availableSections, isLoading: isLoadingSections, error: sectionsError } = useQuery<SectionInfo[]>({
     queryKey: ['sections'],
     queryFn: async () => {
         const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/sections`);
         if (!response.ok) throw new Error('Failed to fetch sections');
         return response.json(); // Expecting array: [{id: "basic", title: "Basic Info"}, ...]
     },
     staleTime: Infinity, // Cache indefinitely
     refetchOnWindowFocus: false,
  });

 // --- Set Default Language and Sections ---
 useEffect(() => {
    // Set default language to English ('2' corresponds to 'English' in backend config) if available
    if (availableLanguages && !watch('language')) {
        const englishValue = availableLanguages['2']; // Assuming '2' is English key
        if (englishValue) {
            setValue('language', englishValue, { shouldValidate: true });
        }
    }
    // Set default sections once fetched and if none are selected yet
    if (availableSections && selectedSections.length === 0) {
        if (Array.isArray(availableSections)) {
             setValue("sections", availableSections.map(s => s.id), { shouldValidate: true });
             console.log('Default sections set:', availableSections.map(s => s.id));
        } else {
             console.warn('availableSections is not an array when trying to set default sections:', availableSections);
        }
    }
 }, [availableLanguages, availableSections, selectedSections, setValue, watch]);


  // --- Loading and Error Handling ---
  if (isLoadingLanguages || isLoadingSections) {
      return <div className="flex justify-center items-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-lime" /> <span className="ml-2 text-gray-lt">Loading options...</span></div>;
  }

  if (languagesError || sectionsError) {
      return (
          <div className="text-center text-orange bg-destructive/10 p-4 rounded border border-destructive">
              <AlertCircle className="w-6 h-6 mx-auto mb-2"/>
              <p>Error loading report options:</p>
              <p className="text-sm">{languagesError?.message || sectionsError?.message}</p>
          </div>
      );
  }

  // --- Component Logic ---
  const handleSectionToggle = (sectionId: string) => {
    const currentSections = selectedSections || [];
    const updatedSections = currentSections.includes(sectionId)
      ? currentSections.filter(id => id !== sectionId)
      : [...currentSections, sectionId];
    setValue("sections", updatedSections, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  const areAllSectionsSelected = availableSections && selectedSections?.length === availableSections.length;

  const handleToggleAllSections = () => {
    if (!availableSections) return;
    if (areAllSectionsSelected) {
      setValue("sections", [], { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    } else {
      setValue("sections", availableSections.map(s => s.id), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    }
  };

  // --- Render ---
  console.log('Rendering OptionsStep - availableSections:', availableSections, 'Is Array:', Array.isArray(availableSections));
  return (
    <div className="space-y-6 animate-fadeIn">
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
            className="appearance-none w-full p-3 rounded-md border border-input bg-primary text-white focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime text-base pr-8"
            {...register("language")}
            // Default value is handled by useEffect now
            aria-invalid={errors.language ? "true" : "false"}
            aria-describedby="languageError"
            >
              {/* Render options from fetched data */}
              {availableLanguages && Object.entries(availableLanguages).map(([key, value]) => (
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
        <AccordionItem value="advanced" className="border-b-0">
          <AccordionTrigger className="px-4 py-3 text-white hover:bg-navy/50 hover:no-underline font-medium text-base data-[state=open]:bg-navy/50 data-[state=open]:border-b border-input">
            Advanced: Select Report Sections (Optional)
          </AccordionTrigger>
          <AccordionContent className="p-4 bg-primary">
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-lt text-sm">Defaults to all sections if none selected.</p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-blue hover:text-lime px-1 h-auto py-0"
                  onClick={handleToggleAllSections}
                  disabled={!availableSections}
                >
                  {areAllSectionsSelected ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-h-60 overflow-y-auto pr-2">
                {Array.isArray(availableSections) && availableSections.map((section) => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`section-${section.id}`} // Ensure unique ID for label association
                      checked={selectedSections?.includes(section.id)}
                      onCheckedChange={() => handleSectionToggle(section.id)}
                      className="border-gray-lt data-[state=checked]:bg-lime data-[state=checked]:border-lime"
                    />
                    <label
                      htmlFor={`section-${section.id}`}
                      className="text-sm font-medium leading-none text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {section.title}
                    </label>
                  </div>
                ))}
              </div>
              {/* Removed specific error display for sections array itself, RHF handles it generally */}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}