// FILE: account-research-ui/src/pages/ResultPage.tsx
/* ----------------------------------------------------------------
   Result page: previews the generated PDF and fills the available
   space.  Worker is bundled locally (pdfjs‑dist 4.8.69).
-----------------------------------------------------------------*/
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  RefObject,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileText,
  AlertCircle,
  Loader2,
  RotateCcw,
  Home,
  Lightbulb,
  Share,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  FileWarning,
} from 'lucide-react';

import api, { Task } from '../api/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

/* ================================================================
   pdf.js worker  — matches react‑pdf 7.x (pdfjs‑dist 4.8.69)
================================================================ */
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/* ================================================================
   Responsive autoscale hook
================================================================ */
function useAutoScale(
  setScale: (n: number) => void,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const obs = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width; // container width in px
      const newScale = Math.max(0.5, Math.min(width / 595, 3)); // A4 width ≈ 595 pt @72 dpi
      setScale(newScale);
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [setScale]);

  return ref;
}

/* ----------------------------------------------------------------
   Animation variants
---------------------------------------------------------------- */
const pdfViewerVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.2 } },
};

/* ===============================================================
   Component
================================================================ */
export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);

  /* autoscale container ref */
  const containerRef = useAutoScale(setPdfScale);

  /* -------------------------------------------------------------
     Task query
  --------------------------------------------------------------*/
  const {
    data: task,
    isLoading: taskLoading,
    error: taskFetchError,
  } = useQuery<Task>({
    queryKey: ['taskResult', id],
    queryFn: async () => {
      if (!id) throw new Error('Task ID is missing');
      const t = await api.getTaskStatus(id);
      if (t.status !== 'completed') {
        queryClient.invalidateQueries({ queryKey: ['taskStatus', id] });
        throw new Error(`Task status is ${t.status}, not completed.`);
      }
      return t;
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  });

  /* -------------------------------------------------------------
     Download PDF blob  →  File
  --------------------------------------------------------------*/
  const loadPdf = useCallback(async () => {
    if (!id) return;
    setIsPdfLoading(true);
    setPdfError(null);
    setPdfRenderError(null);
    setPdfFile(null);
    setNumPages(null);
    setCurrentPage(1);

    try {
      const blob = await api.downloadPdf(id);
      const file = new File([blob], `account-research-${id}.pdf`, {
        type: 'application/pdf',
      });
      if (file.size === 0) {
        setPdfError('Downloaded PDF file appears to be empty.');
        setIsPdfLoading(false);
        return;
      }
      setPdfFile(file);
    } catch (err: any) {
      setPdfError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to fetch PDF data.',
      );
      setIsPdfLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (task?.status === 'completed') loadPdf();
  }, [task?.status, loadPdf]);

  /* -------------------------------------------------------------
     react‑pdf callbacks
  --------------------------------------------------------------*/
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    setIsPdfLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    setPdfError(`${error.message}. You can still try downloading it.`);
    setIsPdfLoading(false);
    setPdfFile(null);
  };

  const onPageRenderError = (error: Error) =>
    setPdfRenderError(`Page error: ${error.message}`);

  /* -------------------------------------------------------------
     Helpers
  --------------------------------------------------------------*/
  const goToPrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const goToNextPage = () =>
    setCurrentPage((p) => Math.min(p + 1, numPages || 1));
  const zoomIn = () => setPdfScale((s) => Math.min(s + 0.2, 3));
  const zoomOut = () => setPdfScale((s) => Math.max(s - 0.2, 0.5));

  /* -------------------------------------------------------------
     Early returns
  --------------------------------------------------------------*/
  if (taskLoading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-lime" />
      </div>
    );
  }
  if (taskFetchError || !task || task.status !== 'completed') {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-destructive mr-3" />
        {taskFetchError
          ? taskFetchError.message
          : `Task status is '${task?.status}'.`}
      </div>
    );
  }

  /* =============================================================
                           MAIN RENDER
  ============================================================= */
  return (
    <div className="min-h-[calc(100vh-10rem)] p-4 md:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-center md:text-left">
            Report Ready
          </h1>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? 'Downloading…' : 'Download PDF'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/generate')}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Create Another
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ============================== PDF Preview ============================== */}
          <div className="w-full lg:flex-1 flex flex-col">
            {/* Controls */}
            <div className="flex justify-between items-center mb-3 sticky top-0 md:top-4 bg-card/90 backdrop-blur-sm rounded-md border border-border shadow px-3 py-2 z-20">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={zoomOut}
                  disabled={pdfScale <= 0.5}
                >
                  <ZoomOut className="w-5 h-5" />
                </Button>
                <span className="text-sm font-medium px-3 py-1 rounded bg-secondary/50">
                  {Math.round(pdfScale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={zoomIn}
                  disabled={pdfScale >= 3}
                >
                  <ZoomIn className="w-5 h-5" />
                </Button>
              </div>
              {numPages && numPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevPage}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="text-sm font-medium">
                    Page {currentPage} / {numPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextPage}
                    disabled={currentPage >= numPages}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Viewer */}
            <div
              className="flex-1 bg-secondary/20 rounded-md h-[calc(100vh-22rem)]
                         overflow-auto hide-scrollbars p-4 flex items-center
                         justify-center relative"
            >
              {/* Loading */}
              {isPdfLoading && (
                <motion.div
                  key="loading"
                  variants={pdfViewerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm rounded-md space-y-3 z-10"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-lime" />
                  <p className="text-sm">Loading PDF Preview…</p>
                </motion.div>
              )}

              {/* Error */}
              {pdfError && !isPdfLoading && (
                <motion.div
                  key="error"
                  variants={pdfViewerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute inset-0 flex flex-col items-center justify-center text-center text-destructive p-6 space-y-3"
                >
                  <FileWarning className="w-10 h-10" />
                  <p className="font-semibold">Error Loading Preview</p>
                  <p className="text-sm max-w-sm">{pdfError}</p>
                  <Button variant="secondary" size="sm" onClick={loadPdf}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Retry Preview
                  </Button>
                </motion.div>
              )}

              {/* Document */}
              {pdfFile && !pdfError && (
                <motion.div
                  key="pdfdoc"
                  variants={pdfViewerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  ref={containerRef}
                  className="w-full"
                >
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading=""
                    error=""
                    className="flex flex-col items-center"
                  >
                    <Page
                      key={`page_${currentPage}`}
                      pageNumber={currentPage}
                      renderTextLayer
                      renderAnnotationLayer
                      scale={pdfScale}
                      className="react-pdf__Page shadow-lg mx-auto"
                      onRenderError={onPageRenderError}
                      loading={
                        <Loader2 className="w-6 h-6 animate-spin text-lime my-10" />
                      }
                    />
                    {pdfRenderError && (
                      <div className="text-destructive text-sm p-4 text-center">
                        <AlertCircle className="inline w-4 h-4 mr-1" />
                        {pdfRenderError}
                      </div>
                    )}
                  </Document>
                </motion.div>
              )}
            </div>
          </div>

          {/* =============================== Side Column ============================== */}
          <div className="w-full lg:w-1/3 space-y-6 lg:space-y-8">
            <ReportInfo task={task} />
            <NextSteps />
            <ReportActions
              onDownload={handleDownload}
              isDownloading={downloading}
            />
          </div>
        </div>
      </div>
    </div>
  );

  /* -------------------------------------------------------------
     Download helper
  --------------------------------------------------------------*/
  async function handleDownload() {
    if (!id || downloading) return;
    setDownloading(true);
    try {
      const blob = await api.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const companyName =
        task?.request?.company_name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
        id;
      const a = document.createElement('a');
      a.href = url;
      a.download = `Supervity_Account_Report_${companyName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setPdfError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }
}

/* =============================================================
   Helper components
=============================================================*/
const ReportInfo = ({ task }: { task: Task }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.1 }}
    className="bg-card rounded-xl p-6 border border-border"
  >
    <h3 className="text-xl font-semibold mb-5 flex items-center gap-2">
      <FileText className="w-5 h-5 text-lime" /> Report Details
    </h3>
    <div className="space-y-3 text-sm">
      <DetailItem label="Target" value={task.request?.company_name} />
      <DetailItem label="Requester" value={task.request?.platform_company_name} />
      <DetailItem
        label="Language"
        value={
          task.request?.language_key === '2'
            ? 'English'
            : task.request?.language_key === '1'
            ? 'German'
            : 'English'
        }
      />
      <DetailItem
        label="Generated"
        value={new Date(task.created_at).toLocaleString()}
      />
      {task.completed_at && (
        <DetailItem
          label="Completed"
          value={new Date(task.completed_at).toLocaleString()}
        />
      )}

      <div className="pt-3 mt-3 border-t border-border">
        <h4 className="text-base font-medium mb-2">Selected Sections:</h4>
        <div className="flex flex-wrap gap-2">
          {task.request?.sections?.length ? (
            task.request.sections.map((s) => (
              <Badge key={s} variant="secondary">
                {s.replace(/_/g, ' ')}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="italic">
              All standard sections included
            </Badge>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

const NextSteps = () => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.2 }}
    className="bg-card rounded-xl p-6 border border-border"
  >
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      <Lightbulb className="w-5 h-5 text-lime" /> Next Steps
    </h3>
    <ul className="space-y-2 text-sm list-decimal list-inside marker:text-lime">
      <li>Review the generated PDF report thoroughly.</li>
      <li>Utilize the insights for your account planning.</li>
      <li>Share the report with relevant team members.</li>
      <li>Need more details? Generate another report.</li>
    </ul>
  </motion.div>
);

const ReportActions = ({
  onDownload,
  isDownloading,
}: {
  onDownload: () => void;
  isDownloading: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-xl p-6 border border-border space-y-3"
    >
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Share className="w-5 h-5 text-lime" /> Actions
      </h3>
      <Button
        variant="primary"
        onClick={onDownload}
        disabled={isDownloading}
        className="w-full flex items-center justify-center gap-2"
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {isDownloading ? 'Downloading…' : 'Download PDF'}
      </Button>
      <Button
        variant="secondary"
        onClick={() => navigate('/history')}
        className="w-full flex items-center gap-2"
      >
        <ExternalLink className="w-4 h-4" /> View All Reports
      </Button>
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="w-full flex items-center gap-2"
      >
        <Home className="w-4 h-4" /> Go to Home
      </Button>
    </motion.div>
  );
};

const DetailItem = ({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) => (
  <div className="flex justify-between items-start gap-4">
    <span className="text-muted-foreground flex-shrink-0">{label}:</span>
    <span className="text-right break-words">{value ?? 'N/A'}</span>
  </div>
);
