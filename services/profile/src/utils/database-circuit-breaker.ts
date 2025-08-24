/**
 * Database Circuit Breaker for Profile Service
 * 
 * Provides fault tolerance for database operations to prevent
 * cascading failures when the database is experiencing issues
 */

import mongoose from 'mongoose';

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

class DatabaseCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`Database circuit breaker is OPEN for ${this.options.name}`);
      error.name = 'CircuitBreakerError';
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
      console.log(`[Profile DB Circuit Breaker] State changed from ${this.state} to ${newState}`);
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

  // Database-specific helper methods
  async checkDatabaseHealth(): Promise<boolean> {
    try {
      const result = await this.execute(async () => {
        if (mongoose.connection.readyState !== 1) {
          throw new Error('Database connection is not ready');
        }
        
        // Simple ping to test connection
        await mongoose.connection.db.admin().ping();
        return true;
      });
      return result;
    } catch (error) {
      console.error('[Profile DB Circuit Breaker] Database health check failed:', error);
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
        
        console.warn(`[Profile DB Circuit Breaker] Attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }

    throw lastError!;
  }
}

// Create singleton instance for profile service database operations
export const profileDatabaseCircuitBreaker = new DatabaseCircuitBreaker({
  name: 'profile-database',
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000 // 30 seconds
});

export { DatabaseCircuitBreaker };
