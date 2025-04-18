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
  FileText,
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

// Generate task step logs based on current status and progress
const getTaskLogs = (taskStatus: string | undefined, progress: number | undefined) => {
  const baseLogs = [
    { id: 'init', label: 'Initializing Task', status: 'pending' },
    { id: 'disambiguation', label: 'Confirming Target Company', status: 'pending' },
    { id: 'fetch_data', label: 'Gathering Source Information', status: 'pending' },
    { id: 'analyze_data', label: 'Analyzing Data & Generating Sections', status: 'pending' },
    { id: 'compile_report', label: 'Compiling Report Sections', status: 'pending' },
    { id: 'generate_pdf', label: 'Generating Final PDF', status: 'pending' },
  ];

  if (!taskStatus) return baseLogs;

  const currentProgress = progress ?? 0;

  if (taskStatus === 'failed') {
    return baseLogs.map(log => ({ ...log, status: log.id === 'init' ? 'completed' : 'failed' }));
  }

  const thresholds = [0, 5, 15, 75, 90, 95, 100]; // Progress thresholds for each step
  let currentStepIndex = -1;

  for (let i = 0; i < thresholds.length - 1; i++) {
    if (currentProgress >= thresholds[i]) {
      currentStepIndex = i;
    } else {
      break;
    }
  }

  return baseLogs.map((log, index) => {
    let status: string;
    if (index < currentStepIndex) {
      status = 'completed';
    } else if (index === currentStepIndex) {
      status = taskStatus === 'completed' ? 'completed' : 'processing';
    } else {
      status = 'pending';
    }

    // If overall task is completed, mark all as completed
    if(taskStatus === 'completed') {
      status = 'completed';
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
  const [isCheckingStorage, setIsCheckingStorage] = useState(true);

  // Check local storage for user info on component mount
  useEffect(() => {
    const checkUserInfo = () => {
      const taskQueryResult = queryClient.getQueryState(['taskStatus', id]);
      if (taskQueryResult?.status === 'pending' || taskQueryResult?.fetchStatus === 'fetching') {
          console.log('ProgressPage: Skipping user info check while task status is loading or fetching.');
          setIsCheckingStorage(false);
          return;
      }
      if (String(taskQueryResult?.status) === 'error') {
          console.log('ProgressPage: Skipping user info check because task status query failed.');
          setIsCheckingStorage(false);
          setUserInfoDialogOpen(false);
          return;
      }

      setIsCheckingStorage(true);
      const storedUserInfo = localStorage.getItem('userInfo');
      
      if (storedUserInfo) {
        try {
          // Basic validation to ensure it's valid JSON
          const parsedInfo = JSON.parse(storedUserInfo);
          // Check if all required fields are present
          if (parsedInfo.name && parsedInfo.email && parsedInfo.designation) {
            setHasUserInfo(true);
            setUserInfoDialogOpen(false); // Explicitly close if info is valid
          } else {
            localStorage.removeItem('userInfo'); // Clear invalid data
            // Only show if task is likely valid and not failed
            if (taskQueryResult && String(taskQueryResult.status) === 'error') {
              console.log('ProgressPage: Invalid user info, but task query failed, keeping dialog closed.');
              setUserInfoDialogOpen(false);
            } else {
              console.log('ProgressPage: Invalid user info found, opening dialog.');
              setUserInfoDialogOpen(true);
            }
          }
        } catch {
          localStorage.removeItem('userInfo'); // Clear invalid data
          // Only show if task is likely valid and not failed
          if (taskQueryResult && String(taskQueryResult.status) === 'error') {
            console.log('ProgressPage: Invalid user info format, but task query failed, keeping dialog closed.');
            setUserInfoDialogOpen(false);
          } else {
            console.log('ProgressPage: Invalid user info format, opening dialog.');
            setUserInfoDialogOpen(true);
          }
        }
      } else {
        // Only show if task is likely valid and not failed
        if (taskQueryResult && String(taskQueryResult.status) === 'error') {
          console.log('ProgressPage: No user info, but task query failed, keeping dialog closed.');
          setUserInfoDialogOpen(false);
        } else {
          console.log('ProgressPage: No user info found, opening dialog.');
          setUserInfoDialogOpen(true);
        }
      }
      setIsCheckingStorage(false);
    };

    // Small delay to ensure smooth UI transition
    const timer = setTimeout(checkUserInfo, 100);
    return () => clearTimeout(timer);
  }, [id, queryClient]);

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
    try {
      localStorage.setItem('userInfo', JSON.stringify(data));
      setHasUserInfo(true);
      setUserInfoDialogOpen(false);
      reset(); // Clear form after successful submission
    } catch (error) {
      console.error("Failed to save user info:", error);
      // Optionally show an error message to the user
    }
  };

  // Task status polling using react-query
  const { data: task, error: taskError, isLoading: isTaskLoading } = useQuery<Task>({
    queryKey: ['taskStatus', id],
    queryFn: () => {
      if (!id) throw new Error("Task ID is missing");
      return api.getTaskStatus(id);
    },
    enabled: !!id && hasUserInfo, // Only poll if ID exists and user info is provided
    refetchInterval: (query) => {
      // Stop polling if task is completed or failed
      const taskData = query.state.data;
      if (taskData?.status === 'completed' || taskData?.status === 'failed') {
        return false;
      }
      return 5000; // Poll every 5 seconds otherwise
    },
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 2, // Retry failed requests twice
  });

  // Navigate to result page on completion
  useEffect(() => {
    if (task?.status === 'completed') {
      // Optional delay before navigating
      const timer = setTimeout(() => {
        navigate(`/task/${id}/result`);
      }, 1000); // 1 second delay
      return () => clearTimeout(timer);
    }
  }, [task?.status, id, navigate]);

  // Derive logs based on task status and progress
  const taskLogs = getTaskLogs(task?.status, task?.progress);

  // Only show progress UI when we have user info and a valid task ID
  const showProgressUI = hasUserInfo && id && !isCheckingStorage;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-primary text-foreground p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* Loading state while checking localStorage */}
        {isCheckingStorage && (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 text-lime animate-spin mx-auto mb-3" />
            <p className="text-white">Preparing your report generation...</p>
          </div>
        )}

        {/* User Info Modal */}
        <Dialog 
          open={userInfoDialogOpen} 
          onOpenChange={(open) => { 
            // Prevent closing if we don't have user info yet
            if (!open && !hasUserInfo) setUserInfoDialogOpen(true);
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
                  Provide your details so we can keep track of your request and potentially notify you upon completion.
                </DialogDescription>
              </DialogHeader>

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
            </DialogContent>
          </DialogPortal>
        </Dialog>

        {/* Main Progress Display Area */}
        {showProgressUI && (
          <div className="bg-navy rounded-xl p-6 md:p-8 shadow-lg animate-fadeIn">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">Generating Your Report</h1>

            {isTaskLoading && !task && ( // Initial loading state
              <div className="text-center py-10">
                <Loader2 className="w-8 h-8 text-lime animate-spin mx-auto mb-4" />
                <p className="text-white">Loading task status...</p>
              </div>
            )}

            {taskError && ( // Error fetching task status
              <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-4 rounded-lg text-center">
                <AlertCircle className="w-6 h-6 mx-auto mb-2"/>
                <h3 className="font-semibold mb-1">Error Loading Task</h3>
                <p className="text-sm mb-4">Could not retrieve task status. Please check the task ID or try again later.</p>
                <Button variant="outline" onClick={() => window.location.reload()} className="text-white border-gray-dk hover:bg-gray-dk">
                  Refresh Page
                </Button>
              </div>
            )}

            {task?.status === 'failed' && ( // Task processing failed
              <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-4 rounded-lg text-center">
                <XCircle className="w-6 h-6 mx-auto mb-2"/>
                <h3 className="font-semibold mb-1">Task Failed</h3>
                <p className="text-sm mb-4">{task.error || 'An unexpected error occurred during report generation.'}</p>
                <Button variant="primary" className="bg-lime text-primary hover:bg-lime/90" onClick={() => navigate('/generate')}>
                  Start New Report
                </Button>
              </div>
            )}

            {task && task.status !== 'failed' && task.status !== 'completed' && ( // Task is pending or processing
              <>
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-lt mb-1">
                    <span>Overall Progress</span>
                    {/* Show percentage only when processing */}
                    <span>{task.status === 'running' ? `${Math.round(task.progress ?? 0)}%` : 'Initializing...'}</span>
                  </div>
                  <Progress 
                    value={task.status === 'running' ? task.progress : 5} 
                    className="h-3 bg-gray-dk" 
                  />
                </div>

                {/* Progress Logs */}
                <div className="space-y-3 border-t border-gray-dk pt-4">
                  <h3 className="text-lg font-medium text-white mb-2">Generation Steps:</h3>
                  {taskLogs.map((log) => (
                    <div key={log.id} className={cn(
                      "flex items-center gap-3 text-sm p-2 rounded",
                      log.status === 'completed' ? 'text-lime' : 'text-gray-lt',
                      log.status === 'processing' ? 'text-blue bg-blue/10' : '',
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
                    <li>Report generation can take several minutes depending on complexity.</li>
                    <li>The AI is analyzing vast amounts of data to ensure accuracy.</li>
                    <li>You can leave this page open; polling will continue in the background (if window is focused).</li>
                    <li>Once complete, you'll be redirected to the results page automatically.</li>
                  </ul>
                </div>
              </>
            )}
            
            {task && task.status === 'completed' && ( // Briefly show completion message before redirect
              <div className="text-center py-10 text-lime">
                <CheckCircle className="w-8 h-8 mx-auto mb-3" />
                <p className="font-semibold">Report Generated Successfully!</p>
                <p className="text-sm text-gray-lt">Redirecting to results...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}