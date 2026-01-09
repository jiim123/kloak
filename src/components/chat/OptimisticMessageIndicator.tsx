import { motion } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MotionDiv } from '@/components/ui/motion-elements';

interface OptimisticMessageIndicatorProps {
  status: 'pending' | 'failed' | null;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function OptimisticMessageIndicator({ 
  status, 
  onRetry, 
  onCancel,
  className 
}: OptimisticMessageIndicatorProps) {
  if (!status) return null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {status === 'pending' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <MotionDiv
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-muted-foreground"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Sending...</span>
            </MotionDiv>
          </TooltipTrigger>
          <TooltipContent>
            <p>Message is being sent</p>
          </TooltipContent>
        </Tooltip>
      )}

      {status === 'failed' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">Failed</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Failed to send message</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-0.5 ml-1">
            {onRetry && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    onClick={onRetry}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry sending</p>
                </TooltipContent>
              </Tooltip>
            )}

            {onCancel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={onCancel}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel message</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
