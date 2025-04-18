// FILE: account-research-ui/src/pages/ResultPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import { Download, FileText, AlertCircle, Loader2, RotateCcw, Home, Lightbulb, Share, ExternalLink } from 'lucide-react';

import api, { Task } from '../api/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
  }, [task?.status, id]); 

  // Handle PDF document loading success
  function onDocumentLoadSuccess({ numPages: nextNumPages }: { numPages: number }) {
    setNumPages(nextNumPages);
    setCurrentPage(1); // Reset to first page when document loads
  }

  // Handle PDF document loading error
  function onDocumentLoadError(error: Error) {
    console.error("React-PDF load error:", error);
    setPdfError(`Failed to render PDF preview: ${error.message}. Try downloading.`);
    setIsPdfLoading(false);
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

  // ---- Render Logic ----

  if (taskLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
        <div className="text-center text-white animate-fadeIn">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-lime" />
          <p className="text-xl">Loading report details...</p>
        </div>
      </div>
    );
  }

  if (taskFetchError || !task || task.status !== 'completed') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-primary p-6 flex items-center justify-center">
        <div className="w-full max-w-lg bg-navy rounded-xl p-6 shadow-lg text-center animate-fadeIn">
          <AlertCircle className="w-12 h-12 text-orange mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Cannot Load Report</h2>
          <p className="text-gray-lt mb-6 text-sm">
            {taskFetchError ? `Error: ${taskFetchError.message}` : `Task status is '${task?.status || 'unknown'}'. The report might not be ready or an error occurred.`}
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline" 
              className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime"
              onClick={() => navigate('/history')}
            >
              Go to History
            </Button>
            <Button
              variant="primary" 
              className="bg-lime text-primary hover:bg-lime/90"
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
      <div className="max-w-7xl mx-auto animate-fadeIn">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white text-center md:text-left">
            Account Research Report Ready
          </h1>
          <div className="flex gap-3">
            <Button 
              variant="primary" 
              onClick={handleDownload} 
              disabled={downloading || isPdfLoading || !!pdfError} 
              className="bg-lime text-primary hover:bg-lime/90 flex items-center gap-2"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading...' : 'Download PDF'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/generate')} 
              className="text-white border-gray-dk hover:bg-navy hover:border-lime hover:text-lime"
            >
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadPdf} 
                    className="text-white border-gray-dk hover:bg-gray-dk"
                  >
                    <RotateCcw className="w-4 h-4 mr-1"/> Retry Preview
                  </Button>
                </div>
              )}
              
              {!isPdfLoading && pdfFile && !pdfError && (
                <>
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading=""
                    error=""
                    className="flex flex-col items-center"
                  >
                    <Page
                      pageNumber={currentPage}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="mb-4 shadow-md"
                      width={Math.min(window.innerWidth * 0.6, 800)}
                    />
                  </Document>
                  
                  {/* PDF Page Controls */}
                  {numPages && numPages > 1 && (
                    <div className="flex justify-between items-center bg-gray-100 p-2 rounded-b">
                      <Button 
                        onClick={goToPrevPage} 
                        disabled={currentPage <= 1} 
                        variant="outline" 
                        size="sm" 
                        className="bg-white"
                      >
                        Previous
                      </Button>
                      
                      <p className="text-sm font-medium">
                        Page {currentPage} of {numPages}
                      </p>
                      
                      <Button 
                        onClick={goToNextPage} 
                        disabled={currentPage >= (numPages || 1)} 
                        variant="outline" 
                        size="sm" 
                        className="bg-white"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Information & Actions Panel */}
          <div className="w-full lg:w-1/3 space-y-6">
            {/* Report Details Card */}
            <ReportInfo task={task} />

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

            {/* Actions */}
            <div className="bg-navy rounded-xl p-5 shadow-lg border border-gray-dk space-y-3">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Share className="w-5 h-5 text-lime" /> Report Actions
              </h2>
              
              <Button 
                variant="outline" 
                onClick={handleDownload} 
                disabled={downloading} 
                className="text-white border-gray-dk hover:bg-gray-dk w-full flex items-center justify-center gap-2 mb-2"
              >
                <Download className="w-4 h-4" /> 
                Download PDF
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/history')} 
                className="text-white border-gray-dk hover:bg-gray-dk w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2"/> View All Reports
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/')} 
                className="text-white border-gray-dk hover:bg-gray-dk w-full"
              >
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

// Content in the information panel on the right side
const ReportInfo = ({ task }: { task: Task }) => {
  return (
    <div className="bg-navy rounded-xl p-6 shadow-lg border border-gray-dk h-fit">
      <div className="border-b border-border pb-4 mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-lime" />
          Report Details
        </h3>
        <div className="space-y-2 text-sm">
          <DetailItem label="Target Company" value={task.request?.company_name || 'N/A'} />
          <DetailItem label="Your Company" value={task.request?.platform_company_name || 'N/A'} />
          <DetailItem label="Report Language" value={task.request?.language_key === '2' ? 'English' : 
                                                     task.request?.language_key === '1' ? 'German' : 'English'} />
          <DetailItem label="Generated" value={new Date(task.created_at).toLocaleString()} />
          {task.completed_at && (
            <DetailItem label="Completed" value={new Date(task.completed_at).toLocaleString()} />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-lime" />
          Selected Report Sections
        </h3>
        <div className="flex flex-wrap gap-2">
          {task.request?.sections && task.request.sections.length > 0 ? 
            task.request.sections.map(section => (
              <Badge key={section} variant="default" className="bg-blue/10 text-blue border border-blue/30">
                {section.replace(/_/g, ' ')}
              </Badge>
            ))
          : (
            <p className="text-gray-lt text-sm italic">All standard sections</p>
          )}
        </div>
      </div>
    </div>
  );
};