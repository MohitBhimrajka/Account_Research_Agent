import { useState } from 'react';
import { useWizardForm } from '@/contexts/WizardContext';
import { AboutYouStep } from './steps/AboutYouStep';
import { TargetCompanyStep } from './steps/TargetCompanyStep';
import { OptionsStep } from './steps/OptionsStep';
import ProgressPage from '../ProgressPage';
import ResultPage from '../ResultPage';

/**
 * 3‑step wizard that collects all data before submitting to the API.
 * After “Generate” it switches to ProgressPage, and when finished to ResultPage.
 */
export default function WizardLayout() {
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);      // backend task id
  const [status, setStatus] = useState<'form' | 'progress' | 'done'>('form');

  /* -------------- helpers -------------- */
  const next = () => setStep((s) => Math.min(s + 1, 2));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  /* -------------- render steps -------------- */
  const renderCurrentStep = () => {
    switch (step) {
      case 0: return <AboutYouStep onNext={next} />;
      case 1: return <TargetCompanyStep onNext={next} onBack={back} />;
      case 2: return (
        <OptionsStep
          onBack={back}
          onGenerate={(id) => {             // id returned from backend
            setTaskId(id);
            setStatus('progress');
          }}
        />
      );
      default: return null;
    }
  };

  /* -------------- final render -------------- */
  if (status === 'progress' && taskId)
    return <ProgressPage taskId={taskId} onDone={() => setStatus('done')} />;

  if (status === 'done' && taskId)
    return <ResultPage taskId={taskId} />;

  return (
    <WizardProvider currentStep={step} setCurrentStep={setStep}>
      <main className="min-h-screen bg-black text-white flex flex-col items-center py-10">
        <h1 className="text-3xl font-bold mb-8">
          New&nbsp;Report&nbsp;Wizard
        </h1>

        <div className="w-full max-w-2xl space-y-10 bg-navy-blue/30 rounded-xl p-10 shadow-xl">
          {renderCurrentStep()}
        </div>
      </main>
    </WizardProvider>
  );
}
