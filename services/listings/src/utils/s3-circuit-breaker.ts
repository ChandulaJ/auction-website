/**
 * S3 Circuit Breaker for Listings Service
 * 
 * Provides fault tolerance for AWS S3 operations to prevent
 * cascading failures when S3 service is experiencing issues
 */

import AWS from 'aws-sdk';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
}

class S3CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`S3 circuit breaker is OPEN for ${this.options.name}`);
      error.name = 'CircuitBreakerError';
      
      // For S3 operations, we can provide fallback behavior
      console.warn(`[S3 Circuit Breaker] ${error.message} - Operation blocked`);
      throw error;
    }

    this.totalRequests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private canExecute(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;
      case CircuitState.OPEN:
        if (now - (this.lastFailureTime || 0) >= this.options.timeout) {
          this.changeState(CircuitState.HALF_OPEN);
          return true;
        }
        return false;
      case CircuitState.HALF_OPEN:
        return true;
      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.options.successThreshold) {
        this.changeState(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.options.failureThreshold) {
      this.changeState(CircuitState.OPEN);
    }
  }

  private changeState(newState: CircuitState): void {
    if (this.state !== newState) {
      console.log(`[S3 Circuit Breaker] State changed from ${this.state} to ${newState}`);
      this.state = newState;
      
      if (newState === CircuitState.CLOSED) {
        this.failureCount = 0;
        this.successCount = 0;
      } else if (newState === CircuitState.HALF_OPEN) {
        this.successCount = 0;
      }
    }
  }

  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      lastFailureTime: this.lastFailureTime,
      uptime: this.totalRequests > 0 ? ((this.totalRequests - this.totalFailures) / this.totalRequests * 100).toFixed(2) + '%' : '100%'
    };
  }

  trip(): void {
    this.changeState(CircuitState.OPEN);
    this.lastFailureTime = Date.now();
  }

  forceReset(): void {
    this.changeState(CircuitState.CLOSED);
  }

  // S3-specific helper methods
  async checkS3Health(): Promise<boolean> {
    try {
      const result = await this.execute(async () => {
        const s3 = new AWS.S3();
        // Simple list buckets operation to test S3 connectivity
        await s3.listBuckets().promise();
        return true;
      });
      return result;
    } catch (error) {
      console.error('[S3 Circuit Breaker] S3 health check failed:', error);
      return false;
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries || error.name === 'CircuitBreakerError') {
          throw error;
        }
        
        console.warn(`[S3 Circuit Breaker] Attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }

    throw lastError!;
  }

  // Safe S3 operations with fallback
  async safeUpload(uploadOperation: () => Promise<AWS.S3.ManagedUpload.SendData>): Promise<AWS.S3.ManagedUpload.SendData | null> {
    try {
      return await this.executeWithRetry(uploadOperation);
    } catch (error) {
      if (error.name === 'CircuitBreakerError') {
        console.warn('[S3 Circuit Breaker] Upload blocked by circuit breaker - file upload temporarily unavailable');
        return null; // Return null to indicate upload failed but don't crash the request
      }
      throw error;
    }
  }

  async safeDelete(deleteOperation: () => Promise<AWS.S3.DeleteObjectOutput>): Promise<AWS.S3.DeleteObjectOutput | null> {
    try {
      return await this.executeWithRetry(deleteOperation);
    } catch (error) {
      if (error.name === 'CircuitBreakerError') {
        console.warn('[S3 Circuit Breaker] Delete blocked by circuit breaker - file deletion temporarily unavailable');
        return null; // Return null to indicate delete failed but don't crash the request
      }
      throw error;
    }
  }
}

// Create singleton instance for listings service S3 operations
export const listingsS3CircuitBreaker = new S3CircuitBreaker({
  name: 'listings-s3',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000 // 60 seconds - S3 may need longer recovery time
});

export { S3CircuitBreaker };
