// FILE: account-research-ui/src/pages/generate/steps/AboutYouStep.tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWizardForm } from '../../../contexts/WizardContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion';
import { Checkbox } from '../../../components/ui/checkbox';
import { Button } from '../../../components/ui/button';
import {
  User,
  Globe,
  Settings,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type LanguagesMap = Record<string, string>;
type SectionInfo = { id: string; title: string };

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export function AboutYouStep() {
  // ---------------------------------------------------------------------------
  // Form context
  // ---------------------------------------------------------------------------
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useWizardForm();

  const selectedSections = watch('sections', []);

  // ---------------------------------------------------------------------------
  // Language query
  // ---------------------------------------------------------------------------
  const {
    data: availableLanguages,
    isLoading: isLoadingLanguages,
    error: languagesError,
  } = useQuery<LanguagesMap>({
    queryKey: ['languages'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/languages`,
      );
      if (!response.ok) throw new Error('Failed to fetch languages');
      return response.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------------
  // Section query
  // ---------------------------------------------------------------------------
  const {
    data: availableSections,
    isLoading: isLoadingSections,
    error: sectionsError,
  } = useQuery<SectionInfo[]>({
    queryKey: ['sections'],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/sections`,
      );
      if (!response.ok) throw new Error('Failed to fetch sections');
      const data = await response.json();
      if (!Array.isArray(data))
        throw new Error('Invalid format for sections data');
      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // default language
    if (availableLanguages && !watch('language')) {
      const englishValue = availableLanguages['2'];
      const fallback = Object.values(availableLanguages)[0];
      setValue('language', englishValue ?? fallback, {
        shouldValidate: true,
      });
    }

    // default sections
    if (
      availableSections &&
      Array.isArray(availableSections) &&
      selectedSections.length === 0
    ) {
      setValue(
        'sections',
        availableSections.map((s) => s.id),
        { shouldValidate: true },
      );
    }
  }, [
    availableLanguages,
    availableSections,
    selectedSections.length,
    setValue,
    watch,
  ]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handleSectionToggle = (sectionId: string) => {
    const current = selectedSections || [];
    const updated = current.includes(sectionId)
      ? current.filter((id: string) => id !== sectionId)
      : [...current, sectionId];
    setValue('sections', updated, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const areAllSectionsSelected =
    Array.isArray(availableSections) &&
    selectedSections?.length === availableSections.length;

  const handleToggleAllSections = () => {
    if (!Array.isArray(availableSections)) return;
    setValue(
      'sections',
      areAllSectionsSelected ? [] : availableSections.map((s) => s.id),
      { shouldValidate: true, shouldDirty: true, shouldTouch: true },
    );
  };

  // ---------------------------------------------------------------------------
  // UI state flags  ***FIXED***
  // ---------------------------------------------------------------------------
  const loadingState = isLoadingLanguages || isLoadingSections;
  const errorState = languagesError || sectionsError;
  const languageReady = !!availableLanguages && !languagesError;
  const sectionReady =
    Array.isArray(availableSections) && availableSections.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------
           Heading
      ---------------------------------------------------------------- */}
      <h2 className="text-xl font-semibold text-card-foreground mb-4 flex items-center gap-2">
        <User className="text-lime w-5 h-5" />
        Step&nbsp;2:&nbsp;Your&nbsp;Details&nbsp;&amp;&nbsp;Report&nbsp;Options
      </h2>

      {/* ---------------------------------------------------------------
           Company name
      ---------------------------------------------------------------- */}
      <div>
        <p className="text-muted-foreground text-sm mb-2">
          Tell us your company name. This helps tailor strategic insights.
        </p>
        <div>
          <label
            htmlFor="userCompany"
            className="sr-only block text-sm font-medium text-muted-foreground mb-1"
          >
            Your Company Name
          </label>
          <input
            id="userCompany"
            type="text"
            className="w-full p-3 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring text-base"
            placeholder="e.g., Supervity Inc."
            {...register('userCompany')}
            aria-invalid={errors.userCompany ? 'true' : 'false'}
            aria-describedby="userCompanyError"
          />
          {errors.userCompany && (
            <p
              id="userCompanyError"
              className="text-destructive text-xs mt-1 px-1"
            >
              {String(errors.userCompany.message)}
            </p>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------
           Divider & options
      ---------------------------------------------------------------- */}
      <div className="mt-8 pt-6 border-t border-border/50">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">
          Report Customization
        </h3>

        {/* ---------------- Loading ---------------- */}
        {loadingState && (
          <div className="flex justify-center items-center min-h-[100px] text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-lime mr-2" />
            <span>Loading options…</span>
          </div>
        )}

        {/* ---------------- Error ---------------- */}
        {!loadingState && errorState && (
          <div className="text-center text-destructive-foreground bg-destructive/10 p-4 rounded border border-destructive">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            <p>Error loading report options:</p>
            <p className="text-sm">
              {languagesError?.message || sectionsError?.message}
            </p>
          </div>
        )}

        {/* ---------------- Options ---------------- */}
        {!loadingState && !errorState && (languageReady || sectionReady) && (
          <div className="space-y-6">
            {/* ---------------- Language select (shown when ready) */}
            {languageReady && (
              <div>
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  Report Language
                </label>
                <div className="relative">
                  <select
                    id="language"
                    className="appearance-none w-full p-3 rounded-md border border-input bg-background text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring text-base pr-8"
                    {...register('language')}
                    aria-invalid={errors.language ? 'true' : 'false'}
                    aria-describedby="languageError"
                  >
                    {Object.entries(availableLanguages!).map(
                      ([key, value]) => (
                        <option
                          key={key}
                          value={value}
                          className="bg-background text-foreground"
                        >
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.language && (
                  <p
                    id="languageError"
                    className="text-destructive text-xs mt-1 px-1"
                  >
                    {String(errors.language.message)}
                  </p>
                )}
              </div>
            )}

            {/* ---------------- Section select (shown when ready) */}
            {sectionReady && (
              <Accordion
                type="single"
                collapsible
                defaultValue="sections"
                className="w-full border border-input rounded-md overflow-hidden bg-background"
              >
                <AccordionItem value="sections" className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 text-card-foreground hover:bg-secondary/30 font-medium text-base data-[state=open]:bg-secondary/30 data-[state=open]:border-b border-input flex items-center gap-1 transition-colors">
                    <Settings className="w-4 h-4" />
                    Select Report Sections&nbsp;(Optional)
                  </AccordionTrigger>
                  <AccordionContent className="p-4 border-t border-border">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-muted-foreground text-sm">
                          Defaults to all sections if none are selected.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-accent hover:text-accent/90 px-1 h-auto py-0"
                          onClick={handleToggleAllSections}
                        >
                          {areAllSectionsSelected
                            ? 'Deselect All'
                            : 'Select All'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-h-60 overflow-y-auto p-1">
                        {availableSections!.map((section) => (
                          <div
                            key={section.id}
                            className="flex items-center space-x-2 group"
                          >
                            <Checkbox
                              id={`section-${section.id}`}
                              checked={selectedSections?.includes(section.id)}
                              onCheckedChange={() =>
                                handleSectionToggle(section.id)
                              }
                              className="border-muted-foreground data-[state=checked]:bg-accent data-[state=checked]:border-accent transition-all"
                            />
                            <label
                              htmlFor={`section-${section.id}`}
                              className="text-sm font-medium leading-none text-foreground group-hover:text-accent cursor-pointer select-none transition-colors"
                            >
                              {section.title}
                            </label>
                          </div>
                        ))}
                      </div>
                      {errors.sections && (
                        <p className="text-destructive text-xs mt-1 px-1">
                          {String(errors.sections.message)}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
