"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-background text-foreground">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md mb-8">
            {this.state.error?.message || 'An unexpected error occurred while rendering the application.'}
          </p>
          <div className="flex gap-4">
            <Button 
              onClick={() => window.location.reload()} 
              variant="default"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reload Page
            </Button>
            <Button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              variant="outline"
            >
              Clear Data & Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
