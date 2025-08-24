/**
 * Enhanced Stripe integration with Circuit Breaker protection
 * 
 * Provides fault tolerance for Stripe API calls to prevent cascading failures
 * when Stripe service is experiencing issues
 */

import Stripe from 'stripe';

// Simple Circuit Breaker implementation for payments service
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

class PaymentCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`Payment circuit breaker is OPEN - Stripe API calls are blocked`);
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
        if (this.shouldAttemptReset(now)) {
          this.setState(CircuitState.HALF_OPEN);
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
        this.reset();
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.options.failureThreshold) {
        this.setState(CircuitState.OPEN);
      }
    }
  }

  private shouldAttemptReset(now: number): boolean {
    return this.lastFailureTime !== null && 
           (now - this.lastFailureTime) >= this.options.timeout;
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.setState(CircuitState.CLOSED);
  }

  private setState(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    
    if (newState !== previousState) {
      console.log(`[Payment Circuit Breaker] State changed from ${previousState} to ${newState}`);
      
      if (newState === CircuitState.OPEN) {
        console.error('⚠️  Payment circuit breaker OPEN - Stripe API calls will be blocked');
      } else if (newState === CircuitState.CLOSED) {
        console.info('✅ Payment circuit breaker CLOSED - Stripe API restored');
      }
    }

    if (newState === CircuitState.HALF_OPEN || newState === CircuitState.OPEN) {
      this.successCount = 0;
    }
  }

  getStats() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      errorRate: this.totalRequests > 0 ? (this.totalFailures / this.totalRequests) * 100 : 0
    };
  }

  isHealthy(): boolean {
    return this.state !== CircuitState.OPEN;
  }
}

class StripeWithCircuitBreaker {
  private stripe: Stripe;
  private circuitBreaker: PaymentCircuitBreaker;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2020-08-27',
    });

    this.circuitBreaker = new PaymentCircuitBreaker({
      name: 'stripe-api',
      failureThreshold: 3, // Trip after 3 failures
      successThreshold: 2, // Require 2 successes to close
      timeout: 30000 // 30 seconds before attempting recovery
    });
  }

  /**
   * Create a charge with circuit breaker protection
   */
  async createCharge(params: Stripe.ChargeCreateParams): Promise<Stripe.Charge> {
    return this.circuitBreaker.execute(async () => {
      console.log('[Stripe Circuit Breaker] Creating charge...');
      
      try {
        const charge = await this.stripe.charges.create(params);
        console.log(`[Stripe Circuit Breaker] Charge created successfully: ${charge.id}`);
        return charge;
      } catch (error: any) {
        // Log the specific Stripe error
        console.error('[Stripe Circuit Breaker] Charge creation failed:', {
          message: error.message,
          type: error.type,
          code: error.code,
          statusCode: error.statusCode
        });

        // Re-throw with additional context
        const enhancedError = new Error(`Stripe charge creation failed: ${error.message}`);
        enhancedError.name = 'StripeChargeError';
        (enhancedError as any).originalError = error;
        (enhancedError as any).stripeErrorType = error.type;
        (enhancedError as any).stripeErrorCode = error.code;
        
        throw enhancedError;
      }
    });
  }

  /**
   * Retrieve a charge with circuit breaker protection
   */
  async retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    return this.circuitBreaker.execute(async () => {
      console.log(`[Stripe Circuit Breaker] Retrieving charge: ${chargeId}`);
      
      try {
        const charge = await this.stripe.charges.retrieve(chargeId);
        console.log(`[Stripe Circuit Breaker] Charge retrieved successfully: ${charge.id}`);
        return charge;
      } catch (error: any) {
        console.error('[Stripe Circuit Breaker] Charge retrieval failed:', error.message);
        
        const enhancedError = new Error(`Failed to retrieve Stripe charge: ${error.message}`);
        enhancedError.name = 'StripeRetrievalError';
        (enhancedError as any).originalError = error;
        
        throw enhancedError;
      }
    });
  }

  /**
   * Create a refund with circuit breaker protection
   */
  async createRefund(params: Stripe.RefundCreateParams): Promise<Stripe.Refund> {
    return this.circuitBreaker.execute(async () => {
      console.log('[Stripe Circuit Breaker] Creating refund...');
      
      try {
        const refund = await this.stripe.refunds.create(params);
        console.log(`[Stripe Circuit Breaker] Refund created successfully: ${refund.id}`);
        return refund;
      } catch (error: any) {
        console.error('[Stripe Circuit Breaker] Refund creation failed:', error.message);
        
        const enhancedError = new Error(`Stripe refund creation failed: ${error.message}`);
        enhancedError.name = 'StripeRefundError';
        (enhancedError as any).originalError = error;
        
        throw enhancedError;
      }
    });
  }

  /**
   * Get circuit breaker health status
   */
  getHealthStatus() {
    return {
      isHealthy: this.circuitBreaker.isHealthy(),
      stats: this.circuitBreaker.getStats()
    };
  }

  /**
   * Get the raw Stripe instance (use with caution - bypasses circuit breaker)
   */
  getRawStripe(): Stripe {
    console.warn('[Stripe Circuit Breaker] WARNING: Using raw Stripe instance bypasses circuit breaker protection');
    return this.stripe;
  }
}

// Create and export the protected Stripe instance
export const stripe = new StripeWithCircuitBreaker(process.env.STRIPE_KEY!);

// Export the class for testing
export { StripeWithCircuitBreaker, PaymentCircuitBreaker };
