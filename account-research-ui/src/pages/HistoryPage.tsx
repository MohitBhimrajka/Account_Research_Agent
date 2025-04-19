import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, AlertCircle, Loader2, Search } from 'lucide-react';

import api, { Task } from '../api/client';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { cn } from '../lib/utils';

// Status variants mapping for badges
const statusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
    case 'pending':
      return 'info';
    case 'failed':
      return 'warning';
    default:
      return 'default';
  }
};

// Format date to readable string
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
};

// Skeleton loader component
const TableSkeleton = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Company</TableHead>
          <TableHead className="hidden sm:table-cell">Language</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Created</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="h-4 bg-secondary/50 rounded animate-pulse w-24 mb-1"></div>
              <div className="h-3 bg-secondary/30 rounded animate-pulse w-20 md:hidden"></div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <div className="h-4 bg-secondary/50 rounded animate-pulse w-16"></div>
            </TableCell>
            <TableCell>
              <div className="h-5 bg-secondary/50 rounded-full animate-pulse w-16"></div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <div className="h-4 bg-secondary/50 rounded animate-pulse w-28"></div>
            </TableCell>
            <TableCell className="text-right">
              <div className="h-8 bg-secondary/50 rounded animate-pulse w-16 ml-auto"></div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default function HistoryPage() {
  const navigate = useNavigate();
  
  // Fetch tasks
  const { data: tasks, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.listTasks,
    refetchOnWindowFocus: false,
    staleTime: 60000, // 1 minute
  });

  // View task result or progress
  const handleViewTask = (task: Task) => {
    if (task.status === 'completed') {
      navigate(`/task/${task.task_id}/result`);
    } else {
      navigate(`/task/${task.task_id}`);
    }
  };

  // Refresh list every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetch();
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [refetch]);
  
  return (
    <div className="min-h-[calc(100vh-10rem)] bg-background p-4 md:p-6 lg:p-8">
      <motion.div
         className="max-w-6xl mx-auto"
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-foreground mb-8">Research History</h1>
        
        <div className="bg-card rounded-xl p-6 shadow-lg border border-border">
          {isLoading ? (
            <div>
              <div className="text-sm text-muted-foreground mb-4 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-lime"/>
                <span>Loading task history...</span>
              </div>
              <TableSkeleton />
            </div>
          ) : error ? (
            <div className="text-center py-12 flex flex-col items-center text-destructive">
              <AlertCircle className="w-10 h-10 mb-3"/>
              <p className="font-semibold mb-2">Error Loading History</p>
              <p className="text-sm mb-4">{(error as Error).message}</p>
              <Button onClick={() => refetch()} variant="secondary">
                Try Again
              </Button>
            </div>
          ) : tasks && tasks.length > 0 ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <Table>
                <TableCaption>Your past account research tasks.</TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden sm:table-cell">Language</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <motion.tr
                      key={task.task_id}
                      variants={rowVariants}
                      className={cn(
                        "border-b border-border transition-colors hover:bg-secondary/30 data-[state=selected]:bg-secondary",
                        "group"
                      )}
                    >
                      <TableCell className="font-medium text-card-foreground py-3">
                        {task.request?.company_name || 'N/A'}
                        <div className="text-xs text-muted-foreground md:hidden">
                          {formatDate(task.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-3 hidden sm:table-cell">
                        {task.request?.language_key === '2' ? 'English' : 
                        task.request?.language_key === '1' ? 'German' : 
                        'English'}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant={statusVariant(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-3 hidden md:table-cell">
                        {formatDate(task.created_at)}
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTask(task)}
                          className="text-accent opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4"/> View
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </motion.div>
          ) : (
            <div className="text-center py-16 flex flex-col items-center text-muted-foreground">
              <Search className="w-12 h-12 mb-4 text-muted-foreground"/>
              <p className="text-lg font-medium text-foreground mb-3">No Research Tasks Found</p>
              <p className="text-sm mb-6">Get started by creating your first report.</p>
              <Button onClick={() => navigate('/generate')} variant="primary">
                Create Report
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
} 