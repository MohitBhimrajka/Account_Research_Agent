// FILE: account-research-ui/src/pages/ResultPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Download, FileText, AlertCircle, Loader2, RotateCcw, Home,
  Lightbulb, Share, ExternalLink, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileWarning
} from 'lucide-react';

import api, { Task } from '../api/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils'; // Ensure cn is available

// Configure PDF.js worker (ensure this path is correct relative to your build output)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const pdfViewerVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } },
};

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0); // State for zoom

  // Fetch task data
  const { data: task, isLoading: taskLoading, error: taskFetchError } = useQuery<Task>({
    queryKey: ['taskResult', id],
    queryFn: async () => {
      if (!id) throw new Error("Task ID is missing");
      // Attempt to get potentially updated status
      const currentTask = await api.getTaskStatus(id);
      if (currentTask.status !== 'completed') {
        // Re-invalidate the status query 
        queryClient.invalidateQueries({ queryKey: ['taskStatus', id] });
        throw new Error(`Task status is ${currentTask.status}, not completed.`);
      }
      return currentTask;
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Function to fetch and set the PDF blob as a File
  const loadPdf = useCallback(async () => {
    if (!id) return;
    console.log('Attempting to load PDF...');
    setIsPdfLoading(true);
    setPdfError(null);
    setPdfFile(null); // Reset previous file
    setNumPages(null);
    setCurrentPage(1);
    try {
      const blob = await api.downloadPdf(id);
      const file = new File([blob], `account-research-${id}.pdf`, { type: 'application/pdf' });
      console.log('PDF blob fetched, creating File object:', file);
      setPdfFile(file);
      // Loading state will be set to false in onDocumentLoadSuccess or onError
    } catch (error: any) {
      console.error('Error fetching PDF blob:', error);
      setPdfError(error.response?.data?.detail || error.message || 'Failed to fetch PDF data.');
      setIsPdfLoading(false);
    }
  }, [id]);

  // Load PDF data once the task is confirmed completed
  useEffect(() => {
    if (task?.status === 'completed') {
      loadPdf();
    }
  }, [task?.status, loadPdf]); // Depend on loadPdf callback

  // Handle PDF document loading success
  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    console.log(`PDF document loaded successfully with ${nextNumPages} pages.`);
    setNumPages(nextNumPages);
    setCurrentPage(1);
    setIsPdfLoading(false); // PDF is ready to be displayed
    setPdfError(null); // Clear any previous error
  }

  // Handle PDF document loading error
  function onDocumentLoadError(error: Error) {
    console.error("React-PDF document load error:", error);
    // Check for common errors
    let message = error.message || 'Failed to load PDF document for preview.';
    if (message.includes('PasswordException')) {
        message = 'The PDF document is password protected and cannot be previewed.';
    } else if (message.includes('InvalidPDFException')) {
        message = 'The downloaded file is not a valid PDF or is corrupted.';
    }
    setPdfError(`${message} You can still try downloading it.`);
    setIsPdfLoading(false);
    setPdfFile(null); // Clear potentially bad file ref
  }

  // Handle Download Button Click
  const handleDownload = async () => {
    if (!id || downloading) return;
    setDownloading(true);
    try {
      const blob = await api.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use target company name in filename if available, otherwise task ID
      const companyName = task?.request?.company_name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || id;
      a.download = `Supervity_Account_Report_${companyName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      setPdfError(error.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Page navigation functions
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, numPages || 1));
  const zoomIn = () => setPdfScale(prev => Math.min(prev + 0.2, 3.0)); // Limit max zoom
  const zoomOut = () => setPdfScale(prev => Math.max(prev - 0.2, 0.5)); // Limit min zoom

  // ---- Render Logic ----

  if (taskLoading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] bg-background p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-foreground"
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-lime" />
          <p className="text-xl font-medium">Loading Report Details...</p>
        </motion.div>
      </div>
    );
  }

  if (taskFetchError || !task || task.status !== 'completed') {
    return (
      <div className="min-h-[calc(100vh-10rem)] bg-background p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-card rounded-xl p-8 shadow-xl text-center"
        >
          <AlertCircle className="w-14 h-14 text-destructive mx-auto mb-5" />
          <h2 className="text-2xl font-semibold text-card-foreground mb-3">Cannot Load Report</h2>
          <p className="text-muted-foreground mb-8 text-base">
            {taskFetchError ? `Error: ${taskFetchError.message}` : `Task status is '${task?.status || 'unknown'}'. The report might not be ready or an error occurred.`}
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate('/history')}
            >
              Go to History
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/generate')}
            >
              Start New Report
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main Result Page Layout
  return (
    <div className="min-h-[calc(100vh-10rem)] bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto animate-slide-up-fade-in"> {/* Use a wider max-width and animation */}
        {/* Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground text-center md:text-left">
            Report Ready
          </h1>
          <div className="flex flex-wrap gap-3 justify-center md:justify-end">
             <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2" // Primary is now Lime bg, Black text
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading...' : 'Download PDF'}
            </Button>
            <Button
              variant="secondary" // Use secondary (gray) button
              onClick={() => navigate('/generate')}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4"/> Create Another
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

          {/* PDF Preview Area (Left/Main Column) */}
          <div className="w-full lg:flex-1 bg-card rounded-xl p-4 md:p-6 shadow-lg border border-border overflow-hidden flex flex-col">
             {/* PDF Controls - Sticky Bar */}
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-card/90 backdrop-blur-sm z-10 py-2 px-1 rounded-t-md border-b border-border">
                 <div className="flex gap-2">
                     <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={zoomOut} 
                         disabled={pdfScale <= 0.5} 
                         aria-label="Zoom Out"
                         title="Zoom Out"
                     >
                         <ZoomOut className="w-5 h-5"/>
                     </Button>
                     <span className="text-sm font-medium px-3 py-2 rounded bg-secondary/50 text-secondary-foreground flex items-center justify-center min-w-[60px]" aria-live="polite" aria-atomic="true">
                         {Math.round(pdfScale * 100)}%
                     </span>
                     <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={zoomIn} 
                         disabled={pdfScale >= 3.0} 
                         aria-label="Zoom In"
                         title="Zoom In"
                     >
                         <ZoomIn className="w-5 h-5"/>
                     </Button>
                 </div>
                 {numPages && numPages > 1 && (
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={goToPrevPage} 
                            disabled={currentPage <= 1} 
                            aria-label="Previous Page"
                            title="Previous Page"
                        >
                             <ChevronLeft className="w-5 h-5"/>
                        </Button>
                        <span className="text-sm font-medium text-muted-foreground" aria-live="polite" aria-atomic="true">
                            Page {currentPage} of {numPages}
                        </span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={goToNextPage} 
                            disabled={currentPage >= numPages} 
                            aria-label="Next Page"
                            title="Next Page"
                        >
                            <ChevronRight className="w-5 h-5"/>
                        </Button>
                    </div>
                 )}
            </div>

            {/* PDF Viewer Container */}
            <div 
                className="flex-1 bg-secondary/20 rounded-md min-h-[70vh] max-h-[75vh] w-full overflow-auto p-4 flex items-center justify-center relative"
                aria-label="PDF Document Viewer"
                role="region"
            >
                <AnimatePresence mode="wait">
                    {/* Loading State */}
                    {isPdfLoading && (
                        <motion.div
                            key="loading"
                            variants={pdfViewerVariants} initial="hidden" animate="visible" exit="exit"
                            className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-3"
                            aria-live="polite"
                            aria-label="Loading PDF"
                        >
                            <motion.div 
                                animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.8, 1, 0.8] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="bg-card/60 backdrop-blur-sm rounded-xl p-6 shadow-lg flex flex-col items-center"
                            >
                                <Loader2 className="w-10 h-10 animate-spin text-lime mb-3" />
                                <p className="text-sm font-medium">Loading PDF Preview...</p>
                                <p className="text-xs text-muted-foreground mt-1">Please wait, preparing your report</p>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* Error State */}
                    {pdfError && !isPdfLoading && (
                        <motion.div
                            key="error"
                            variants={pdfViewerVariants} initial="hidden" animate="visible" exit="exit"
                            className="absolute inset-0 flex flex-col items-center justify-center text-center text-destructive p-6 space-y-3"
                            aria-live="assertive"
                            role="alert"
                        >
                            <FileWarning className="w-10 h-10" />
                            <p className="font-semibold">Error Loading Preview</p>
                            <p className="text-sm max-w-sm">{pdfError}</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={loadPdf}
                                className="mt-2 flex items-center gap-1"
                            >
                                <RotateCcw className="w-4 h-4"/> Retry Preview
                            </Button>
                        </motion.div>
                    )}

                    {/* PDF Document */}
                    {!isPdfLoading && pdfFile && !pdfError && (
                        <motion.div
                            key="pdfdoc"
                            variants={pdfViewerVariants} initial="hidden" animate="visible" exit="exit"
                            aria-live="polite"
                        >
                            <Document
                                file={pdfFile}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading="" // Handled by our state
                                error=""   // Handled by our state
                                className="flex flex-col items-center pdf-document"
                                inputRef={(ref) => {
                                    if (ref) {
                                        ref.setAttribute('aria-label', 'PDF Document');
                                    }
                                }}
                            >
                                {/* Apply scale */}
                                <Page
                                    pageNumber={currentPage}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    scale={pdfScale}
                                    className="react-pdf__Page" // Keep default class for potential CSS overrides
                                    inputRef={(ref) => {
                                        if (ref) {
                                            ref.setAttribute('aria-label', `PDF Page ${currentPage}`);
                                        }
                                    }}
                                />
                            </Document>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div> {/* End PDF Viewer Container */}
          </div> {/* End PDF Preview Area */}

          {/* Information & Actions Panel (Right Column) */}
          <div className="w-full lg:w-1/3 space-y-6 lg:space-y-8">
            <ReportInfo task={task} />
            <NextSteps />
            <ReportActions onDownload={handleDownload} isDownloading={downloading} />
          </div> {/* End Right Column */}

        </div> {/* End Main Content Area */}
      </div> {/* End Max Width Container */}
    </div> /* End Page Root */
  );
}

// --- Helper Components ---

// Report Info Card
const ReportInfo = ({ task }: { task: Task }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
    className="bg-card rounded-xl p-6 shadow-lg border border-border"
  >
    <h3 className="text-xl font-semibold text-card-foreground mb-5 flex items-center gap-2">
      <FileText className="w-5 h-5 text-lime" /> Report Details
    </h3>
    <div className="space-y-3 text-sm">
      <DetailItem label="Target" value={task.request?.company_name} />
      <DetailItem label="Requester" value={task.request?.platform_company_name} />
      <DetailItem label="Language" value={task.request?.language_key === '2' ? 'English' : task.request?.language_key === '1' ? 'German' : 'English'} />
      <DetailItem label="Generated" value={new Date(task.created_at).toLocaleString()} />
      {task.completed_at && <DetailItem label="Completed" value={new Date(task.completed_at).toLocaleString()} />}

      <div className="pt-3 mt-3 border-t border-border">
        <h4 className="text-base font-medium text-card-foreground mb-2">Selected Sections:</h4>
        <div className="flex flex-wrap gap-2">
          {task.request?.sections && task.request.sections.length > 0 ?
            task.request.sections.map(section => (
              <Badge key={section} variant="secondary" className="font-normal"> {/* Use gray badge */}
                {section.replace(/_/g, ' ')}
              </Badge>
            ))
            : (
            <Badge variant="outline" className="font-normal italic">All standard sections included</Badge>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

// Next Steps Card
const NextSteps = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
      className="bg-card rounded-xl p-6 shadow-lg border border-border"
    >
        <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-lime" /> Next Steps
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-decimal list-inside marker:text-lime">
            <li>Review the generated PDF report thoroughly.</li>
            <li>Utilize the insights for your account planning.</li>
            <li>Share the report with relevant team members.</li>
            <li>Need more details? Generate another report.</li>
        </ul>
    </motion.div>
);

// Report Actions Card
const ReportActions = ({ onDownload, isDownloading }: { onDownload: () => void, isDownloading: boolean }) => {
    const navigate = useNavigate();
    return (
        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-6 shadow-lg border border-border space-y-3"
        >
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Share className="w-5 h-5 text-lime" /> Actions
            </h3>
            <Button
                variant="primary"
                onClick={onDownload}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2"
            >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                {isDownloading ? 'Downloading...' : 'Download PDF'}
            </Button>
             <Button
                variant="secondary"
                onClick={() => navigate('/history')}
                className="w-full flex items-center justify-center gap-2"
            >
                <ExternalLink className="w-4 h-4"/> View All Reports
            </Button>
            <Button
                variant="ghost" // Use ghost for less emphasis
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-2"
            >
                <Home className="w-4 h-4"/> Go to Home
            </Button>
        </motion.div>
    );
}

// Helper component for detail items
const DetailItem = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="flex justify-between items-start gap-4">
    <span className="text-muted-foreground flex-shrink-0">{label}:</span>
    <span className="text-card-foreground text-right break-words">{value ?? 'N/A'}</span>
  </div>
);