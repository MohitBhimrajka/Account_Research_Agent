// FILE: account-research-ui/src/pages/ProgressPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  User,
  Mail,
  Briefcase,
  Lightbulb,
} from 'lucide-react';

import api, { Task } from '../api/client';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';

// Define the user info schema
const userInfoSchema = z.object({
  name: z.string().min(2, { message: 'Name is required (min 2 chars).' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  designation: z.string().min(2, { message: 'Job Title/Designation is required (min 2 chars).' }),
});

type UserInfo = z.infer<typeof userInfoSchema>;

// Task section statuses mapped to UI components
const StatusIcon = ({ status }: { status: string }) => {
  const baseClasses = "w-5 h-5 flex-shrink-0";
  switch (status) {
    case 'completed':
      return <CheckCircle className={cn(baseClasses, "text-lime")} />;
    case 'failed':
      return <XCircle className={cn(baseClasses, "text-orange")} />;
    case 'pending':
      return <Clock className={cn(baseClasses, "text-gray-lt")} />;
    case 'running':
    case 'processing':
      return <Loader2 className={cn(baseClasses, "text-blue animate-spin")} />;
    default:
      return <AlertCircle className={cn(baseClasses, "text-gray-lt")} />;
  }
};

// Updated getTaskLogs function
const getTaskLogs = (taskStatus: string | undefined, progress: number | undefined) => {
  const baseLogs = [
    { id: 'init', label: 'Initializing Task', status: 'pending' },
    { id: 'disambiguation', label: 'Confirming Target Company', status: 'pending' }, // Assuming this step exists conceptually
    { id: 'fetch_data', label: 'Gathering Source Information', status: 'pending' },
    { id: 'analyze_data', label: 'Analyzing Data & Generating Sections', status: 'pending' },
    { id: 'compile_report', label: 'Compiling Report Sections', status: 'pending' },
    { id: 'generate_pdf', label: 'Generating Final PDF', status: 'pending' },
  ];

  if (!taskStatus || progress === undefined) {
      // If task status or progress is unknown, show all as pending
      if (taskStatus === 'failed') { // Special case: if status is failed but progress unknown
         return baseLogs.map((log, index) => ({ ...log, status: index === 0 ? 'completed' : 'failed' }));
      }
      return baseLogs;
  }

  const currentProgress = progress;

  if (taskStatus === 'failed') {
    // Mark the first step as complete, the rest as failed
    return baseLogs.map((log, index) => ({
        ...log,
        status: index === 0 ? 'completed' : 'failed'
    }));
  }

  // Define approximate progress points for each step to START
  // These might need adjustment based on actual task timings
  const thresholds = [0, 5, 15, 75, 90, 95, 100];
  let currentStepIndex = -1;

  // Find which step we are currently in based on progress (iterate backwards)
  for (let i = thresholds.length - 2; i >= 0; i--) {
      if (currentProgress >= thresholds[i]) {
          currentStepIndex = i;
          break;
      }
  }

   // Handle edge case where progress is 100 but status isn't completed yet
  if (currentProgress === 100 && taskStatus !== 'completed') {
       currentStepIndex = baseLogs.length - 1; // Still on the last step
  } else if (currentProgress === 100 && taskStatus === 'completed') {
      currentStepIndex = baseLogs.length; // All steps are effectively done
  } else if (currentStepIndex === -1 && currentProgress >= 0) {
       currentStepIndex = 0; // Default to first step if no threshold met yet
  }


  return baseLogs.map((log, index) => {
    let status: string;
    if (taskStatus === 'completed' || index < currentStepIndex) {
      status = 'completed'; // If overall task is done OR step index is before current, it's completed
    } else if (index === currentStepIndex && taskStatus !== 'failed' && taskStatus !== 'completed') {
      status = 'processing'; // The current step is processing (unless failed/completed)
    } else {
      status = 'pending'; // Future steps are pending
    }
    return { ...log, status };
  });
};

export default function ProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userInfoDialogOpen, setUserInfoDialogOpen] = useState(false);
  const [hasUserInfo, setHasUserInfo] = useState(false);
  const [isCheckingStorage, setIsCheckingStorage] = useState(true); // Start checking

  // *** Simplified useEffect for checking user info ***
  useEffect(() => {
    setIsCheckingStorage(true); // Start check
    const storedUserInfo = localStorage.getItem('userInfo');
    let isValidInfo = false;

    if (storedUserInfo) {
      try {
        const parsedInfo = JSON.parse(storedUserInfo);
        // Basic validation: check if required fields exist and are truthy
        if (parsedInfo.name && parsedInfo.email && parsedInfo.designation) {
          isValidInfo = true;
        } else {
          console.warn("Stored user info is missing required fields. Clearing.");
          localStorage.removeItem('userInfo'); // Clear invalid data
        }
      } catch (e) {
        console.warn("Failed to parse stored user info. Clearing.", e);
        localStorage.removeItem('userInfo'); // Clear invalid JSON
      }
    }

    setHasUserInfo(isValidInfo);
    // Open the dialog only if the info is NOT valid/present
    setUserInfoDialogOpen(!isValidInfo);
    setIsCheckingStorage(false); // Finish check

    console.log(`ProgressPage Mount: User info check complete. Has valid info: ${isValidInfo}, Dialog should open: ${!isValidInfo}`);

  }, []); // Empty dependency array ensures this runs only once on mount

  // Form handling for user info
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: isFormSubmitting },
    reset,
  } = useForm<UserInfo>({
    resolver: zodResolver(userInfoSchema),
  });

  // Handle user info form submission
  const onUserInfoSubmit = async (data: UserInfo) => {
    console.log("User info submitted:", data);
    try {
      localStorage.setItem('userInfo', JSON.stringify(data));
      setHasUserInfo(true); // Mark info as present
      setUserInfoDialogOpen(false); // Close the dialog
      reset(); // Clear form fields
      // Manually invalidate/refetch the task status query now that user info is confirmed
      if (id) {
        console.log("User info saved, triggering task status refetch for ID:", id);
        await queryClient.invalidateQueries({ queryKey: ['taskStatus', id] });
      }
    } catch (error) {
      console.error("Failed to save user info:", error);
    }
  };

  // Task status polling using react-query
  const { data: task, error: taskError, isLoading: isTaskLoading } = useQuery<Task>({
    queryKey: ['taskStatus', id],
    queryFn: () => {
      if (!id) throw new Error("Task ID is missing");
      console.log(`Fetching task status for ID: ${id}`); // Log query execution
      return api.getTaskStatus(id);
    },
    // *** Updated enabled condition ***
    enabled: !!id && hasUserInfo && !isCheckingStorage,
    refetchInterval: (query) => {
      const taskData = query.state.data;
      if (taskData?.status === 'completed' || taskData?.status === 'failed') {
        console.log(`Task ${id} status is ${taskData.status}. Stopping polling.`);
        return false; // Stop polling
      }
      console.log(`Task ${id} status is ${taskData?.status}. Polling again in 5s.`);
      return 5000; // Poll every 5 seconds otherwise
    },
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Navigate to result page on completion
  useEffect(() => {
    if (task?.status === 'completed') {
      console.log(`Task ${id} completed. Navigating to results page shortly.`);
      const timer = setTimeout(() => {
        if (id) navigate(`/task/${id}/result`);
      }, 1000); // 1 second delay
      return () => clearTimeout(timer);
    }
  }, [task?.status, id, navigate]);

  // Derive logs based on task status and progress
  const taskLogs = getTaskLogs(task?.status, task?.progress);

  // Determine when to show the main progress UI (needs user info and task ID)
  const showProgressUI = hasUserInfo && id && !isCheckingStorage;

  // --- Render Logic ---

  // 1. Handle Storage Checking State
  if (isCheckingStorage) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
        <div className="text-center text-white animate-fadeIn">
          <Loader2 className="w-8 h-8 text-lime animate-spin mx-auto mb-3" />
          <p className="text-xl">Preparing...</p>
        </div>
      </div>
    );
  }

  // 2. User Info Dialog is rendered below, controlled by `userInfoDialogOpen`

  // 3. Handle Task Loading (only shown *after* storage check and if user info is confirmed)
  if (showProgressUI && isTaskLoading && !task) {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
            <div className="text-center text-white animate-fadeIn">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-lime" />
            <p className="text-xl">Loading task status...</p>
            </div>
        </div>
    );
  }

  // 4. Handle Task Fetch Error (only shown *after* storage check and if user info is confirmed)
  if (showProgressUI && taskError) {
      return (
          <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
              <div className="w-full max-w-lg bg-navy rounded-xl p-6 shadow-lg text-center animate-fadeIn">
                  <AlertCircle className="w-12 h-12 text-orange mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-white mb-2">Error Loading Task</h2>
                  <p className="text-gray-lt mb-6 text-sm">
                      Could not retrieve task status: {taskError.message}. Please check the task ID or try again later.
                  </p>
                  <Button
                      variant="outline"
                      className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime"
                      onClick={() => navigate('/history')}
                  >
                      Go to History
                  </Button>
              </div>
          </div>
      );
  }

  // 5. Render Main Content (Progress or Final state)
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-primary text-foreground p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* --- User Info Modal --- */}
        <Dialog
            // Control open state: must be explicitly open AND user info must be missing
            open={userInfoDialogOpen && !hasUserInfo}
            onOpenChange={(open) => {
                // Prevent closing by clicking outside if user info is still required
                if (!open && !hasUserInfo) {
                   setUserInfoDialogOpen(true); // Force it back open
                } else {
                   setUserInfoDialogOpen(open); // Allow closing if intended or if info is now present
                }
            }}
            >
            <DialogPortal>
                <DialogOverlay className="bg-black/80" />
                <DialogContent className="sm:max-w-[480px] bg-navy border-gray-dk rounded-lg animate-fadeIn">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-white flex items-center gap-2">
                        <User className="text-lime" /> Tell Us About Yourself
                        </DialogTitle>
                        <DialogDescription className="text-gray-lt">
                        Provide your details to proceed with tracking the report generation.
                        </DialogDescription>
                    </DialogHeader>

                    {/* User Info Form */}
                    <form onSubmit={handleSubmit(onUserInfoSubmit)} className="space-y-5 py-4">
                        {/* Name Input */}
                        <div className="grid w-full items-center gap-1.5">
                        <label htmlFor="name" className="text-sm font-medium text-gray-lt flex items-center gap-1">
                            <User className="w-4 h-4"/> Name
                        </label>
                        <input
                            id="name"
                            placeholder="Your full name"
                            className="w-full p-2 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime"
                            {...register("name")}
                            aria-invalid={errors.name ? "true" : "false"}
                            aria-describedby="nameError"
                        />
                        {errors.name && <p id="nameError" className="text-orange text-xs mt-1">{errors.name.message}</p>}
                        </div>

                        {/* Email Input */}
                        <div className="grid w-full items-center gap-1.5">
                        <label htmlFor="email" className="text-sm font-medium text-gray-lt flex items-center gap-1">
                            <Mail className="w-4 h-4"/> Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="your.email@example.com"
                            className="w-full p-2 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime"
                            {...register("email")}
                            aria-invalid={errors.email ? "true" : "false"}
                            aria-describedby="emailError"
                        />
                        {errors.email && <p id="emailError" className="text-orange text-xs mt-1">{errors.email.message}</p>}
                        </div>

                        {/* Designation Input */}
                        <div className="grid w-full items-center gap-1.5">
                        <label htmlFor="designation" className="text-sm font-medium text-gray-lt flex items-center gap-1">
                            <Briefcase className="w-4 h-4"/> Job Title / Designation
                        </label>
                        <input
                            id="designation"
                            placeholder="e.g., Sales Manager"
                            className="w-full p-2 rounded-md border border-input bg-primary text-white placeholder-gray-dk focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime"
                            {...register("designation")}
                            aria-invalid={errors.designation ? "true" : "false"}
                            aria-describedby="designationError"
                        />
                        {errors.designation && <p id="designationError" className="text-orange text-xs mt-1">{errors.designation.message}</p>}
                        </div>

                        <DialogFooter className="mt-6">
                        <Button type="submit" disabled={isFormSubmitting} className="bg-lime text-primary hover:bg-lime/90 w-full sm:w-auto">
                            {isFormSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Continue to Progress"}
                        </Button>
                        </DialogFooter>
                    </form>
                    {/* End User Info Form */}

                </DialogContent>
            </DialogPortal>
        </Dialog>
        {/* --- End User Info Modal --- */}


        {/* --- Main Progress Display Area (Show only if user info is available and no errors) --- */}
        {showProgressUI && task ? (
          <div className="bg-navy rounded-xl p-6 md:p-8 shadow-lg animate-fadeIn">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">
              Generating Report for: {task.request?.company_name || '...'}
            </h1>

            {/* Failed State */}
            {task.status === 'failed' && (
              <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-4 rounded-lg text-center mb-6">
                <XCircle className="w-6 h-6 mx-auto mb-2"/>
                <h3 className="font-semibold mb-1">Task Failed</h3>
                <p className="text-sm mb-4">{task.error || 'An unexpected error occurred during report generation.'}</p>
                <Button variant="primary" className="bg-lime text-primary hover:bg-lime/90" onClick={() => navigate('/generate')}>
                  Start New Report
                </Button>
              </div>
            )}

            {/* In Progress State */}
            {(task.status === 'running' || task.status === 'pending') && (
              <>
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-lt mb-1">
                    <span>Overall Progress</span>
                    <span>{`${Math.round(task.progress ?? 0)}%`}</span>
                  </div>
                  <Progress
                      value={Math.min(100, Math.max(0, task.progress ?? 0))}
                      className="h-3 bg-gray-dk"
                    />
                </div>

                <div className="space-y-3 border-t border-gray-dk pt-4">
                  <h3 className="text-lg font-medium text-white mb-2">Generation Steps:</h3>
                  {taskLogs.map((log) => (
                    <div key={log.id} className={cn(
                      "flex items-center gap-3 text-sm p-2 rounded",
                      log.status === 'completed' ? 'text-lime' : 'text-gray-lt',
                      log.status === 'processing' ? 'text-blue bg-blue/10 font-medium' : '', // Highlight processing
                      log.status === 'failed' ? 'text-orange' : ''
                    )}>
                      <StatusIcon status={log.status} />
                      <span>{log.label}</span>
                    </div>
                  ))}
                </div>

                 {/* Tips Section */}
                 <div className="mt-8 border-t border-gray-dk pt-4">
                   <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                     <Lightbulb className="w-5 h-5 text-lime"/> While you wait...
                   </h3>
                   <ul className="list-disc list-inside space-y-2 text-sm text-gray-lt pl-2">
                     <li>Report generation can take several minutes.</li>
                     <li>The AI analyzes data and structures the report.</li>
                     <li>Progress updates automatically.</li>
                     <li>You'll be redirected once the report is ready.</li>
                   </ul>
                 </div>
              </>
            )}

            {/* Completed State (briefly shown before redirect) */}
            {task.status === 'completed' && (
              <div className="text-center py-10 text-lime">
                <CheckCircle className="w-8 h-8 mx-auto mb-3" />
                <p className="font-semibold">Report Generated Successfully!</p>
                <p className="text-sm text-gray-lt">Redirecting to results...</p>
              </div>
            )}
          </div>
          // Case where task is not found after loading and error checks
        ) : showProgressUI && !isTaskLoading && !taskError && !task ? (
             <div className="w-full max-w-lg bg-navy rounded-xl p-6 shadow-lg text-center animate-fadeIn">
                 <AlertCircle className="w-12 h-12 text-orange mx-auto mb-4" />
                 <h2 className="text-xl font-semibold text-white mb-2">Task Not Found</h2>
                 <p className="text-gray-lt mb-6 text-sm">
                     The task with ID '{id}' could not be found. It may have expired or is invalid.
                 </p>
                 <Button
                     variant="outline"
                     className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime"
                     onClick={() => navigate('/history')}
                 >
                     Go to History
                 </Button>
             </div>
         ) : null /* Render nothing if still checking storage or waiting for user info */ }
      </div>
    </div>
  );
}