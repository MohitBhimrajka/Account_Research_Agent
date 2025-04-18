// FILE: account-research-ui/src/pages/ResultPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'; // Import default styling
import 'react-pdf/dist/esm/Page/TextLayer.css'; // Import default styling

import { Download, FileText, AlertCircle, Loader2, RotateCcw, Home } from 'lucide-react';

import api, { Task } from '../api/client'; // Use Task type from client
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge'; // Import Badge

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // Get query client instance
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null); // Store File object
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Fetch task data - ensure it reflects the final state
  const { data: task, isLoading: taskLoading, error: taskFetchError } = useQuery<Task>({
    queryKey: ['taskResult', id], // Use a different query key for the result page fetch
    queryFn: async () => {
        if (!id) throw new Error("Task ID is missing");
        // Attempt to get potentially updated status
        const currentTask = await api.getTaskStatus(id);
        if (currentTask.status !== 'completed') {
             // Maybe the task isn't actually done? Or status endpoint lagged?
             // Re-invalidate the status query to trigger potential refetch on progress page if navigated back
             queryClient.invalidateQueries({ queryKey: ['taskStatus', id] });
             throw new Error(`Task status is ${currentTask.status}, not completed.`);
        }
        return currentTask;
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchInterval: false, // Don't poll on result page
    staleTime: 5 * 60 * 1000, // Cache result data for 5 mins
    retry: 1,
  });

  // Function to fetch and set the PDF blob as a File
  const loadPdf = async () => {
    if (!id) return;
    setIsPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await api.downloadPdf(id);
      // Create a File object for react-pdf
      const file = new File([blob], `account-research-${id}.pdf`, { type: 'application/pdf' });
      setPdfFile(file);
    } catch (error: any) {
      console.error('Error loading PDF:', error);
      setPdfError(error.message || 'Failed to load PDF data. It might not be available.');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Load PDF data once the task is confirmed completed
  useEffect(() => {
    if (task?.status === 'completed') {
      loadPdf();
    }
    // Clean up Blob URL when component unmounts or task changes
    // return () => {
    //   if (pdfUrl) {
    //     URL.revokeObjectURL(pdfUrl);
    //   }
    // };
     // pdfUrl is removed, so cleanup is handled by garbage collection of the File object state
  }, [task?.status, id]); // Depend on task status and id

  // Handle PDF document loading success
  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    setNumPages(nextNumPages);
  }

  // Handle PDF document loading error
  function onDocumentLoadError(error: Error) {
    console.error("React-PDF load error:", error);
    setPdfError(`Failed to render PDF preview: ${error.message}. Try downloading.`);
    setIsPdfLoading(false); // Ensure loading state is off
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
      const companyName = task?.request?.targetCompany?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || id;
      a.download = `Supervity_Account_Report_${companyName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      setPdfError(error.message || 'Download failed. Please try again.'); // Show download error
    } finally {
        setDownloading(false);
    }
  };

  // ---- Render Logic ----

  if (taskLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
        <div className="text-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            Loading report details...
        </div>
      </div>
    );
  }

  if (taskFetchError || !task || task.status !== 'completed') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
        <div className="w-full max-w-lg bg-navy rounded-xl p-6 shadow-lg text-center">
          <AlertCircle className="w-12 h-12 text-orange mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Cannot Load Report</h2>
          <p className="text-gray-lt mb-6 text-sm">
            {taskFetchError ? `Error: ${taskFetchError.message}` : `Task status is '${task?.status || 'unknown'}'. The report might not be ready or an error occurred.`}
          </p>
          <div className="flex gap-4 justify-center">
            <Button
                variant="outline" className="text-white border-gray-dk hover:bg-gray-dk"
                onClick={() => navigate('/history')}
            >
                Go to History
            </Button>
             <Button
                variant="primary" className="bg-lime text-primary hover:bg-lime/90"
                onClick={() => navigate('/generate')}
            >
                Start New Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main Result Page Layout
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-primary p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center md:text-left">
                Account Research Report Ready
            </h1>
            <div className="flex gap-3">
                <Button variant="primary" onClick={handleDownload} disabled={downloading || isPdfLoading || !!pdfError} className="bg-lime text-primary hover:bg-lime/90 flex items-center gap-2">
                    {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                    {downloading ? 'Downloading...' : 'Download PDF'}
                </Button>
                 <Button variant="outline" onClick={() => navigate('/generate')} className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime">
                    Create Another
                </Button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* PDF Preview Area */}
          <div className="w-full lg:w-2/3 bg-navy rounded-xl p-4 shadow-lg border border-gray-dk">
            <div className="bg-gray-200 rounded min-h-[75vh] max-h-[80vh] w-full overflow-y-auto p-2 pdf-viewer-container">
              {isPdfLoading && (
                 <div className="flex items-center justify-center h-full min-h-[500px] text-gray-dk">
                    <Loader2 className="w-6 h-6 animate-spin mr-2"/> Loading PDF Preview...
                </div>
              )}
              {pdfError && !isPdfLoading && (
                 <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center text-orange p-4">
                    <AlertCircle className="w-8 h-8 mb-3" />
                    <p className="font-semibold">Error Loading Preview</p>
                    <p className="text-sm mb-4">{pdfError}</p>
                    <Button variant="outline" size="sm" onClick={loadPdf} className="text-white border-gray-dk hover:bg-gray-dk">
                        <RotateCcw className="w-4 h-4 mr-1"/> Retry Preview
                    </Button>
                 </div>
              )}
              {!isPdfLoading && pdfFile && !pdfError && (
                 <Document
                    file={pdfFile} // Use the File object
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading="" // Handled by isPdfLoading state
                    error="" // Handled by pdfError state
                    className="flex flex-col items-center" // Center pages
                 >
                    {Array.from(new Array(numPages || 0), (_, index) => (
                      <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        renderTextLayer={true} // Enable text layer for selection
                        renderAnnotationLayer={true} // Enable annotation layer
                        className="mb-4 shadow-md"
                        width={Math.min(window.innerWidth * 0.6, 800)} // Responsive width
                      />
                    ))}
                </Document>
              )}
            </div>
          </div>

          {/* Information & Actions Panel */}
          <div className="w-full lg:w-1/3 space-y-6">
            {/* Report Details Card */}
            <div className="bg-navy rounded-xl p-5 shadow-lg border border-gray-dk">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-lime" /> Report Details
                </h3>
                <div className="space-y-2 text-sm">
                  <DetailItem label="Target Company" value={task.request.targetCompany} />
                  <DetailItem label="Report Language" value={task.request.language} />
                  <DetailItem label="Generated" value={new Date(task.created_at).toLocaleString()} />
                   <DetailItem label="Status">
                     <Badge variant={task.status === 'completed' ? 'success' : 'default'}>
                         {task.status}
                     </Badge>
                  </DetailItem>
                  {task.request.sections && task.request.sections.length > 0 && (
                     <DetailItem label="Sections Included" value={`${task.request.sections.length} specific sections`} />
                  )}
                   {task.request.sections && task.request.sections.length === 0 && (
                     <DetailItem label="Sections Included" value="All standard sections" />
                  )}
                </div>
            </div>

             {/* Next Steps Card */}
            <div className="bg-navy rounded-xl p-5 shadow-lg border border-gray-dk">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-lime" /> Next Steps
              </h2>
              <ul className="space-y-2 text-sm text-gray-lt list-decimal list-inside">
                <li>Review the generated PDF report thoroughly.</li>
                <li>Utilize the insights for your account planning and strategy.</li>
                <li>Share the report with relevant team members.</li>
                <li>Need a different focus? <Button variant="link" className="p-0 h-auto text-blue hover:text-lime" onClick={() => navigate('/generate')}>Generate another report</Button> with different options.</li>
              </ul>
            </div>

            <div className="bg-navy rounded-xl p-5 shadow-lg border border-gray-dk text-center">
                 <Button variant="outline" onClick={() => navigate('/')} className="text-white border-gray-dk hover:bg-gray-dk w-full">
                   <Home className="w-4 h-4 mr-2"/> Go to Home
                </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for detail items
const DetailItem = ({ label, value, children }: { label: string; value?: string | number; children?: React.ReactNode }) => (
  <div className="flex justify-between items-start">
    <span className="text-gray-lt font-medium">{label}:</span>
    {children ? (
      <div className="text-right">{children}</div>
    ) : (
      <span className="ml-2 text-white text-right">{value ?? 'N/A'}</span>
    )}
  </div>
);