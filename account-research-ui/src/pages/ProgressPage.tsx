// FILE: account-research-ui/src/pages/ProgressPage.tsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion'; // Import motion
import {
  CheckCircle, XCircle, AlertCircle, Clock, Loader2, User, Mail,
  Briefcase, Lightbulb, ThumbsUp, Activity
} from 'lucide-react';

import api, { Task } from '../api/client';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogOverlay, DialogPortal
} from '../components/ui/dialog';
import { cn } from '../lib/utils';

// User info schema (no changes needed)
const userInfoSchema = z.object({
  name: z.string().min(2, { message: 'Name is required (min 2 chars).' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  designation: z.string().min(2, { message: 'Job Title/Designation is required (min 2 chars).' }),
});
type UserInfo = z.infer<typeof userInfoSchema>;

// --- UI Helper Components ---

// Enhanced Status Icon with animation
const StatusIcon = ({ status }: { status: string }) => {
  const baseClasses = "w-5 h-5 flex-shrink-0";
  const iconMap = {
    completed: <CheckCircle className={cn(baseClasses, "text-lime")} />,
    failed: <XCircle className={cn(baseClasses, "text-destructive")} />, // Use destructive color
    pending: <Clock className={cn(baseClasses, "text-muted-foreground")} />,
    processing: <Loader2 className={cn(baseClasses, "text-blue animate-spin")} />, // Use blue for processing
    default: <AlertCircle className={cn(baseClasses, "text-muted-foreground")} />
  };

  return (
    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
      {iconMap[status as keyof typeof iconMap] || iconMap.default}
    </motion.div>
  );
};

// Define the conceptual steps and thresholds for mimicry
const STEPS_CONFIG = [
  { id: 'init', label: 'Initializing Task', progressThreshold: 0 },
  { id: 'disambiguation', label: 'Confirming Target Company', progressThreshold: 5 },
  { id: 'fetch_data', label: 'Gathering Source Information', progressThreshold: 15 },
  { id: 'analyze_data', label: 'Analyzing & Generating Sections', progressThreshold: 75 },
  { id: 'compile_report', label: 'Compiling Report', progressThreshold: 90 },
  { id: 'generate_pdf', label: 'Generating Final PDF', progressThreshold: 95 },
];
const MIMIC_DURATION_MS = 2 * 60 * 1000; // 2 minutes for full mimic cycle

// --- Main Progress Page Component ---

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // User Info State
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false);
  const [hasUserInfo, setHasUserInfo] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);

  // Mimicry State
  const [mimickedProgress, setMimickedProgress] = useState(0);
  const [currentMimickedStepIndex, setCurrentMimickedStepIndex] = useState(-1);
  const [isMimicking, setIsMimicking] = useState(false);

  // Form Handling (no changes needed)
  const { register, handleSubmit, formState: { errors, isSubmitting: isFormSubmitting }, reset } = useForm<UserInfo>({
    resolver: zodResolver(userInfoSchema),
  });

  // Check Local Storage on Mount
  useEffect(() => {
    console.log("ProgressPage Mount: Checking local storage...");
    setIsCheckingStorage(true);
    const storedUserInfo = localStorage.getItem('userInfo');
    let isValidInfo = false;
    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        userInfoSchema.parse(parsedInfo); // Validate against schema
        isValidInfo = true;
        console.log("Valid user info found in storage.");
      } catch (e) {
        console.warn("Invalid or incomplete user info in storage. Clearing.", e);
        localStorage.removeItem('userInfo');
      }
    } else {
      console.log("No user info found in storage.");
    }
    setHasUserInfo(isValidInfo);
    setUserInfoDialogOpen(!isValidInfo); // Open dialog if info is missing/invalid
    setIsCheckingStorage(false);
    console.log(`Storage check complete. Has valid info: ${isValidInfo}, Dialog should open: ${!isValidInfo}`);
  }, []);

  // User Info Form Submission
  const onUserInfoSubmit = async (data: UserInfo) => {
    console.log("User info submitted:", data);
    try {
      localStorage.setItem('userInfo', JSON.stringify(data));
      setHasUserInfo(true);
      setUserInfoDialogOpen(false);
      reset();
      if (id) {
        console.log("User info saved, triggering task status refetch for ID:", id);
        // Give a brief moment for dialog to close visually before fetching
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ['taskStatus', id] }), 300);
      }
    } catch (error) {
      console.error("Failed to save user info:", error);
      // Handle potential storage errors (e.g., quota exceeded) - maybe show a toast
    }
    // isSubmitting state resets automatically via RHF
  };

  // Fetch Task Status (React Query)
  const { data: task, error: taskError, isLoading: isTaskLoadingInitial } = useQuery<Task>({
    queryKey: ['taskStatus', id],
    queryFn: async () => {
      if (!id) throw new Error("Task ID is missing");
      console.log(`Querying task status for ID: ${id}`);
      return api.getTaskStatus(id);
    },
    enabled: !!id && hasUserInfo && !isCheckingStorage, // Enable only when ready
    refetchInterval: (query) => {
      const taskData = query.state.data;
      // Stop polling if task is completed or failed
      if (taskData?.status === 'completed' || taskData?.status === 'failed') {
        console.log(`Task ${id} status is ${taskData.status}. Stopping polling.`);
        return false;
      }
      // Continue polling otherwise
      console.log(`Task ${id} status is ${taskData?.status ?? 'loading'}. Polling again in 5s.`);
      return 5000;
    },
    refetchOnWindowFocus: true, // Keep true for resilience
    retry: (failureCount, error: any) => {
        // Don't retry for 404 Not Found or specific known "final state" errors from backend if applicable
        if (error?.response?.status === 404) return false;
        return failureCount < 2; // Retry twice for other errors
    },
    staleTime: 1000, // Consider task status potentially stale quickly
  });

  // Derived Loading State (considers initial load vs subsequent background fetches)
  const isEffectivelyLoading = isTaskLoadingInitial && !task;

   // --- Progress Mimicry Logic ---
   useEffect(() => {
       let intervalId: NodeJS.Timeout | null = null;

       // Start mimicking only if the task is running/pending and we aren't already mimicking
       if (task && (task.status === 'running' || task.status === 'pending') && !isMimicking) {
           console.log('Starting progress mimicry...');
           setIsMimicking(true);
           setMimickedProgress(0); // Start from 0
           setCurrentMimickedStepIndex(-1);

           const startTime = Date.now();

           intervalId = setInterval(() => {
               const elapsedTime = Date.now() - startTime;
               let currentProgress = Math.min(100, (elapsedTime / MIMIC_DURATION_MS) * 100);

               // Find the current mimicked step based on progress
               let stepIndex = -1;
               for (let i = STEPS_CONFIG.length - 1; i >= 0; i--) {
                   if (currentProgress >= STEPS_CONFIG[i].progressThreshold) {
                       stepIndex = i;
                       break;
                   }
               }

               setMimickedProgress(currentProgress);
               setCurrentMimickedStepIndex(stepIndex);

               // Stop mimicry if duration is reached (should be superseded by actual task completion)
               if (elapsedTime >= MIMIC_DURATION_MS) {
                   console.log('Mimicry duration reached.');
                   if (intervalId) clearInterval(intervalId);
                   setIsMimicking(false);
                   // Keep progress at 99 until backend confirms completion? Optional.
                   // setMimickedProgress(99);
               }
           }, 100); // Update progress frequently for smoother visuals

       } else if (task && (task.status === 'completed' || task.status === 'failed') && isMimicking) {
           // Stop mimicry if the actual task completes or fails while mimicking
           console.log(`Actual task status (${task.status}) detected. Stopping mimicry.`);
           if (intervalId) clearInterval(intervalId);
           setIsMimicking(false);
           // Ensure final mimicked state matches actual if completed
           if (task.status === 'completed') {
               setMimickedProgress(100);
               setCurrentMimickedStepIndex(STEPS_CONFIG.length); // Mark all steps as done
           }
       }

       // Cleanup interval on component unmount or if task status changes fundamentally
       return () => {
           if (intervalId) {
               clearInterval(intervalId);
               setIsMimicking(false); // Ensure mimicry stops on unmount
           }
       };
   }, [task?.status, isMimicking]); // Re-run when task status or isMimicking changes


   // Navigate to Result Page on Completion
   useEffect(() => {
     if (task?.status === 'completed') {
       console.log(`Task ${id} completed. Navigating to results page shortly.`);
       const timer = setTimeout(() => {
         if (id) navigate(`/task/${id}/result`);
       }, 1500); // Slightly longer delay to appreciate the final checkmark
       return () => clearTimeout(timer);
     }
   }, [task?.status, id, navigate]);


  // --- Derive Displayed Task Steps ---
  const displayedTaskSteps = useMemo(() => {
    // Determine the source of truth: actual task or mimicry
    const progress = isMimicking ? mimickedProgress : task?.progress ?? 0;
    const status = task?.status;
    const stepIndex = isMimicking ? currentMimickedStepIndex : -1; // Only use mimicked index if actively mimicking

    return STEPS_CONFIG.map((step, index) => {
      let stepStatus: string;

      if (status === 'completed') {
        stepStatus = 'completed';
      } else if (status === 'failed') {
        // Mark all steps as failed *after* the first one (init)
        stepStatus = index === 0 ? 'completed' : 'failed';
      } else if (isMimicking) {
        // Use mimicry logic
        if (index <= stepIndex) {
          stepStatus = 'completed'; // Steps up to the current mimicked one are 'done'
        } else {
          stepStatus = 'pending';
        }
        // Highlight the very current step as 'processing'
        if (index === stepIndex + 1) {
             stepStatus = 'processing';
        }
      } else {
        // Fallback if not mimicking and not completed/failed (e.g., loading initial state)
        stepStatus = 'pending';
      }

      // Ensure the first step shows as processing immediately if task is pending/running
      if (index === 0 && (status === 'pending' || status === 'running') && !isMimicking && progress < STEPS_CONFIG[1]?.progressThreshold) {
         stepStatus = 'processing';
      }

      return { ...step, status: stepStatus };
    });
  }, [task?.status, task?.progress, isMimicking, mimickedProgress, currentMimickedStepIndex]);


  // Determine Overall Display Progress (use mimicry if active, otherwise actual)
  const displayProgress = isMimicking ? mimickedProgress : task?.progress ?? 0;
  
  // Add logging for progress tracking
  console.log("ProgressPage Rendering: Display Progress =", displayProgress, "isMimicking =", isMimicking, "mimickedProgress =", mimickedProgress, "actualProgress =", task?.progress);

  // --- Render Logic ---

  // 1. Checking Storage State
  if (isCheckingStorage) {
    return (
      <div className="min-h-[calc(100vh-10rem)] bg-background p-6 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-muted-foreground">
          <Loader2 className="w-8 h-8 text-lime animate-spin mx-auto mb-3" />
          <p>Preparing...</p>
        </motion.div>
      </div>
    );
  }

  // 2. Initial Task Loading State (After storage check, before task data arrives)
  if (isEffectivelyLoading && hasUserInfo) {
    return (
      <div className="min-h-[calc(100vh-10rem)] bg-background p-6 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-lime" />
          <p>Loading task status...</p>
        </motion.div>
      </div>
    );
  }

  // 3. Task Fetch Error State (After storage check)
  if (taskError && hasUserInfo) {
    return (
       <div className="min-h-[calc(100vh-10rem)] bg-background p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-card rounded-xl p-8 shadow-xl text-center"
        >
          <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-5" />
          <h2 className="text-2xl font-semibold text-card-foreground mb-3">Error Loading Task</h2>
          <p className="text-muted-foreground mb-8 text-base">
            Could not retrieve task status: {taskError.message}. Please check the task ID or try again later.
          </p>
           <Button variant="secondary" onClick={() => navigate('/history')}> Go to History </Button>
        </motion.div>
      </div>
    );
  }

  // 4. Render User Info Dialog OR Main Progress Content
  return (
    <div className="min-h-[calc(100vh-10rem)] bg-background text-foreground p-4 md:p-8 flex items-center justify-center">
       <AnimatePresence>
        {/* --- User Info Modal --- */}
        {userInfoDialogOpen && !hasUserInfo && (
           <Dialog open={true} onOpenChange={(open) => { if (!open) setUserInfoDialogOpen(false); }}>
             <DialogPortal forceMount> {/* Use forceMount with AnimatePresence */}
                <DialogOverlay className="bg-black/80 fixed inset-0 z-50" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: "-48%" }}
                  animate={{ opacity: 1, scale: 1, y: "-50%" }}
                  exit={{ opacity: 0, scale: 0.95, y: "-48%" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <DialogContent
                    className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-lg sm:rounded-lg md:w-full"
                    onOpenAutoFocus={(e) => e.preventDefault()} // Prevent autofocus stealing
                  >
                     <DialogHeader>
                       <DialogTitle className="text-xl text-card-foreground flex items-center gap-2">
                         <User className="text-lime" /> Tell Us About Yourself
                       </DialogTitle>
                       <DialogDescription className="text-muted-foreground">
                         Provide your details to track report generation.
                       </DialogDescription>
                     </DialogHeader>
                     <form onSubmit={handleSubmit(onUserInfoSubmit)} className="space-y-5 pt-2 pb-4">
                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="name" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><User className="w-4 h-4"/> Name</label>
                            <input id="name" placeholder="Your full name"
                                className="w-full p-2.5 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:border-accent focus:ring-1 focus:ring-ring"
                                {...register("name")} />
                            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
                        </div>
                        {/* Email Input */}
                         <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Mail className="w-4 h-4"/> Email Address</label>
                            <input id="email" type="email" placeholder="your.email@example.com"
                                className="w-full p-2.5 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:border-accent focus:ring-1 focus:ring-ring"
                                {...register("email")} />
                            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
                        </div>
                         {/* Designation Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="designation" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Briefcase className="w-4 h-4"/> Job Title / Designation</label>
                            <input id="designation" placeholder="e.g., Sales Manager"
                                className="w-full p-2.5 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:border-accent focus:ring-1 focus:ring-ring"
                                {...register("designation")} />
                            {errors.designation && <p className="text-destructive text-xs">{errors.designation.message}</p>}
                        </div>
                         <DialogFooter className="mt-6">
                           <Button type="submit" variant="primary" disabled={isFormSubmitting} className="w-full sm:w-auto">
                             {isFormSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Continue to Progress"}
                           </Button>
                         </DialogFooter>
                     </form>
                  </DialogContent>
                </motion.div>
             </DialogPortal>
           </Dialog>
        )}

         {/* --- Main Progress Display Area (Show only when user info is confirmed) --- */}
        {hasUserInfo && task && (
            <motion.div
                key="progress-ui" // Key for AnimatePresence
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-3xl bg-card rounded-xl p-6 md:p-8 shadow-xl border border-border"
            >
                <h1 className="text-2xl md:text-3xl font-bold text-card-foreground mb-2 text-center">
                   Generating Report
                </h1>
                 <p className="text-center text-muted-foreground mb-8 text-lg">
                    For: <span className="font-medium text-card-foreground">{task.request?.company_name || '...'}</span>
                </p>

                {/* Failed State */}
                {task.status === 'failed' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-destructive/10 border border-destructive text-destructive p-5 rounded-lg text-center mb-6 space-y-3">
                     <XCircle className="w-8 h-8 mx-auto"/>
                     <h3 className="font-semibold text-lg">Task Failed</h3>
                     <p className="text-sm">{task.error || 'An unexpected error occurred.'}</p>
                     <Button variant="primary" onClick={() => navigate('/generate')}> Start New Report </Button>
                  </motion.div>
                )}

                 {/* In Progress / Pending State */}
                {(task.status === 'running' || task.status === 'pending') && (
                  <>
                     <div className="mb-8">
                       <div className="flex justify-between text-sm text-muted-foreground mb-1.5 px-1">
                         <span>Overall Progress</span>
                         <span>{`${Math.round(displayProgress)}%`}</span>
                       </div>
                       <Progress value={displayProgress} className="h-2.5" /> {/* Slightly thicker */}
                     </div>

                     <div className="space-y-3.5">
                       <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center gap-2">
                         <Activity className="w-5 h-5 text-lime"/> Generation Steps:
                       </h3>
                       {displayedTaskSteps.map((step, index) => (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }} // Stagger animation
                            className={cn(
                              "flex items-center gap-3 text-base p-2.5 rounded-md transition-colors duration-200",
                              step.status === 'completed' && 'text-lime',
                              step.status === 'pending' && 'text-muted-foreground opacity-70',
                              step.status === 'processing' && 'text-blue font-medium bg-blue/10',
                              step.status === 'failed' && 'text-destructive'
                            )}
                          >
                            <StatusIcon status={step.status} />
                            <span>{step.label}</span>
                          </motion.div>
                       ))}
                     </div>

                     {/* Tips Section */}
                     <div className="mt-10 border-t border-border pt-6">
                       <h3 className="text-lg font-semibold text-card-foreground mb-3 flex items-center gap-2">
                         <Lightbulb className="w-5 h-5 text-lime"/> While you wait...
                       </h3>
                       <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground pl-2">
                         <li>Report generation usually takes 2-5 minutes.</li>
                         <li>The AI is analyzing data and structuring the report.</li>
                         <li>This page updates automatically. No need to refresh.</li>
                         <li>You'll be redirected automatically when it's done.</li>
                       </ul>
                     </div>
                  </>
                )}

                 {/* Completed State (briefly shown before redirect) */}
                 {task.status === 'completed' && (
                   <motion.div
                     key="completed-state"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.4, type: 'spring' }}
                     className="text-center py-10 text-lime space-y-3"
                   >
                     <ThumbsUp className="w-12 h-12 mx-auto" />
                     <p className="text-xl font-semibold">Report Generated Successfully!</p>
                     <p className="text-sm text-muted-foreground">Redirecting to results...</p>
                   </motion.div>
                 )}

             </motion.div>
         )}
         {/* Handle case where task is not found after loading & error checks */}
          {hasUserInfo && !isEffectivelyLoading && !taskError && !task && (
              <motion.div
                 key="not-found"
                 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                 className="w-full max-w-lg bg-card rounded-xl p-8 shadow-xl text-center"
              >
                  <AlertCircle className="w-14 h-14 text-orange mx-auto mb-5" />
                  <h2 className="text-2xl font-semibold text-card-foreground mb-3">Task Not Found</h2>
                  <p className="text-muted-foreground mb-8 text-base">
                     The task with ID '{id}' could not be found. It might be invalid or has expired.
                  </p>
                  <Button variant="secondary" onClick={() => navigate('/history')}> Go to History </Button>
              </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
}