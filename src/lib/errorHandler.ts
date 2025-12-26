import { toast } from '@/hooks/use-toast';

export type ErrorType = 
  | 'network'
  | 'auth'
  | 'permission'
  | 'validation'
  | 'rate_limit'
  | 'server'
  | 'unknown';

interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: string;
  retryable?: boolean;
}

// Map common error patterns to error types
export function classifyError(error: any): ErrorInfo {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || error?.status;

  // Network errors
  if (!navigator.onLine || errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      type: 'network',
      message: 'Connection lost',
      details: 'Please check your internet connection and try again.',
      retryable: true,
    };
  }

  // Auth errors
  if (errorCode === 401 || errorCode === 403 || errorMessage.includes('unauthorized') || errorMessage.includes('unauthenticated')) {
    return {
      type: 'auth',
      message: 'Authentication error',
      details: 'Your session may have expired. Please log in again.',
      retryable: false,
    };
  }

  // Permission errors
  if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || errorMessage.includes('not allowed')) {
    return {
      type: 'permission',
      message: "You don't have permission to do that",
      details: 'Contact an admin if you think this is a mistake.',
      retryable: false,
    };
  }

  // Rate limit errors
  if (errorCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return {
      type: 'rate_limit',
      message: 'Slow down cowboy!',
      details: 'You\'re doing that too fast. Try again in a few seconds.',
      retryable: true,
    };
  }

  // Validation errors
  if (errorCode === 400 || errorMessage.includes('invalid') || errorMessage.includes('validation')) {
    return {
      type: 'validation',
      message: 'Invalid input',
      details: error?.message || 'Please check your input and try again.',
      retryable: false,
    };
  }

  // Server errors
  if (errorCode >= 500 || errorMessage.includes('server')) {
    return {
      type: 'server',
      message: 'Server error',
      details: 'Something went wrong on our end. Please try again later.',
      retryable: true,
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: 'Something went wrong',
    details: error?.message || 'An unexpected error occurred.',
    retryable: true,
  };
}

// Show appropriate toast based on error type
export function handleError(error: any, customMessage?: string): ErrorInfo {
  const errorInfo = classifyError(error);

  const variantMap: Record<ErrorType, 'destructive' | 'warning' | 'info'> = {
    network: 'warning',
    auth: 'destructive',
    permission: 'destructive',
    validation: 'warning',
    rate_limit: 'warning',
    server: 'destructive',
    unknown: 'destructive',
  };

  toast({
    title: customMessage || errorInfo.message,
    description: errorInfo.details,
    variant: variantMap[errorInfo.type],
    duration: errorInfo.type === 'rate_limit' ? 5000 : undefined,
  });

  return errorInfo;
}

// Success toast helper
export function showSuccess(title: string, description?: string) {
  toast({
    title,
    description,
    variant: 'success',
    duration: 3000,
  });
}

// Info toast helper  
export function showInfo(title: string, description?: string) {
  toast({
    title,
    description,
    variant: 'info',
    duration: 4000,
  });
}

// Warning toast helper
export function showWarning(title: string, description?: string) {
  toast({
    title,
    description,
    variant: 'warning',
    duration: 4000,
  });
}
