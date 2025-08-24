import { ListingStatus } from '@jjmauction/common';
import axios from 'axios';
import { Listing } from '../models';

// Circuit Breaker for service-to-service communication
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

class ServiceCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`Service circuit breaker is OPEN for ${this.options.name}`);
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
      console.log(`[Bid Service Circuit Breaker] '${this.options.name}' changed from ${previousState} to ${newState}`);
      
      if (newState === CircuitState.OPEN) {
        console.warn(`⚠️  Bid service circuit breaker OPEN for ${this.options.name} - calls will be blocked`);
      } else if (newState === CircuitState.CLOSED) {
        console.info(`✅ Bid service circuit breaker CLOSED for ${this.options.name} - service restored`);
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

// Create circuit breaker for listings service calls
const listingsServiceCircuitBreaker = new ServiceCircuitBreaker({
  name: 'listings-service',
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000 // 30 seconds
});

interface ListingData {
  id: string;
  userId: string;
  title: string;
  slug: string;
  startPrice: number;
  currentPrice: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export const syncExistingData = async (): Promise<void> => {
  try {
    console.log('[Bid Service] Syncing existing listings from listings service...');

    const listings = await listingsServiceCircuitBreaker.execute(async () => {
      const listingsServiceUrl = process.env.LISTINGS_SERVICE_URL || 'http://localhost:3103';
      console.log(`[Bid Service] Calling listings service at: ${listingsServiceUrl}/api/listings`);
      
      const response = await axios.get(`${listingsServiceUrl}/api/listings`, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'bid-service-sync'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Listings service returned status ${response.status}`);
      }
      
      return response.data;
    });

    console.log(`[Bid Service] Found ${listings.length} listings to sync`);

    for (const listingData of listings) {
      try {
        const existingListing = await Listing.findOne({
          where: { id: listingData.id },
        });

        if (!existingListing) {
          await Listing.create({
            id: listingData.id,
            userId: listingData.userId,
            title: listingData.title,
            slug: listingData.slug,
            startPrice: listingData.startPrice,
            currentPrice: listingData.currentPrice,
            status: listingData.status as ListingStatus,
            expiresAt: new Date(listingData.expiresAt),
          });
          console.log(`[Bid Service] Created listing: ${listingData.id}`);
        } else {
          // Update existing listing if needed
          await existingListing.update({
            title: listingData.title,
            slug: listingData.slug,
            startPrice: listingData.startPrice,
            currentPrice: listingData.currentPrice,
            status: listingData.status as ListingStatus,
            expiresAt: new Date(listingData.expiresAt),
          });
          console.log(`[Bid Service] Updated listing: ${listingData.id}`);
        }
      } catch (dbError: any) {
        console.error(`[Bid Service] Failed to process listing ${listingData.id}:`, dbError.message);
        // Continue processing other listings even if one fails
      }
    }

    console.log('[Bid Service] Sync completed successfully');
  } catch (error: any) {
    console.error('[Bid Service] Failed to sync listings:', error.message);
    
    if (error.name === 'CircuitBreakerError') {
      console.warn('[Bid Service] Listings service circuit breaker is OPEN - skipping sync');
      // Don't throw error for circuit breaker - service can still operate with existing data
      return;
    }
    
    // For other errors, log but don't crash the service
    console.error('[Bid Service] Sync failed, but service will continue with existing data');
  }
};

// Export circuit breaker stats for health checks
export const getListingsServiceHealth = () => ({
  isHealthy: listingsServiceCircuitBreaker.isHealthy(),
  stats: listingsServiceCircuitBreaker.getStats()
});
