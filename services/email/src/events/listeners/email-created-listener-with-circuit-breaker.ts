/**
 * Email Service with Circuit Breaker protection
 * 
 * Provides fault tolerance for SMTP/email operations to prevent
 * cascading failures when email providers are experiencing issues
 */

import nodemailer from 'nodemailer';
import { EmailCreatedEvent, Listener, Subjects } from '@jjmauction/common';
import { Message } from 'node-nats-streaming';
import { queueGroupName } from './queue-group-name';

// Circuit Breaker implementation for email service
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

class EmailCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      const error = new Error(`Email circuit breaker is OPEN - Email sending is temporarily disabled`);
      error.name = 'CircuitBreakerError';
      
      // For emails, we'll log the failure but not throw - emails are not critical to core functionality
      console.warn(`[Email Circuit Breaker] ${error.message}`);
      return Promise.resolve() as any; // Return empty promise for email operations
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
      console.log(`[Email Circuit Breaker] State changed from ${previousState} to ${newState}`);
      
      if (newState === CircuitState.OPEN) {
        console.warn('⚠️  Email circuit breaker OPEN - Email delivery suspended');
      } else if (newState === CircuitState.CLOSED) {
        console.info('✅ Email circuit breaker CLOSED - Email delivery restored');
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

// Create circuit breaker for email operations
const emailCircuitBreaker = new EmailCircuitBreaker({
  name: 'email-smtp',
  failureThreshold: 3, // Trip after 3 email failures
  successThreshold: 2, // Require 2 successes to close
  timeout: 120000 // 2 minutes before attempting recovery (longer for email)
});

// Create transporter with configuration
const createTransporter = () => {
  const transporterConfig = {
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
    pool: true, // Use connection pooling
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14 // Max 14 emails per second (within Gmail limits)
  };

  console.log('[Email Service] Creating SMTP transporter with circuit breaker protection');
  return nodemailer.createTransporter(transporterConfig);
};

const transporter = createTransporter();

export class EmailCreatedListener extends Listener<EmailCreatedEvent> {
  queueGroupName = queueGroupName;
  subject: Subjects.EmailCreated = Subjects.EmailCreated;

  async onMessage(data: EmailCreatedEvent['data'], msg: Message) {
    const { email, subject, text } = data;

    console.log(`[Email Service] Processing email for: ${email}`);
    console.log(`[Email Service] Subject: ${subject}`);

    try {
      await emailCircuitBreaker.execute(async () => {
        console.log('[Email Service] Sending email via SMTP...');
        
        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject,
          text,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">${subject}</h2>
            <p style="line-height: 1.6; color: #374151;">${text}</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="font-size: 12px; color: #6B7280;">
              This email was sent from Auction Website. 
              <br>If you have any questions, please contact our support team.
            </p>
          </div>`
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[Email Service] Email sent successfully to ${email}`);
        console.log(`[Email Service] Message ID: ${info.messageId}`);
        
        return info;
      });

      // Always acknowledge the message, even if circuit breaker is open
      msg.ack();
      
    } catch (error: any) {
      console.error('[Email Service] Failed to send email:', {
        to: email,
        subject,
        error: error.message,
        errorType: error.name
      });

      // For email failures, we still acknowledge the message to prevent infinite retries
      // This is because emails are not critical to core auction functionality
      msg.ack();
      
      // You could implement a dead letter queue here for failed emails
      // or store them in a database for retry later
    }
  }

  /**
   * Get email service health status
   */
  static getHealthStatus() {
    return {
      isHealthy: emailCircuitBreaker.isHealthy(),
      stats: emailCircuitBreaker.getStats()
    };
  }

  /**
   * Test email connectivity
   */
  static async testEmailConnectivity(): Promise<boolean> {
    try {
      await emailCircuitBreaker.execute(async () => {
        console.log('[Email Service] Testing SMTP connectivity...');
        await transporter.verify();
        console.log('[Email Service] SMTP connectivity test passed');
        return true;
      });
      return true;
    } catch (error: any) {
      console.error('[Email Service] SMTP connectivity test failed:', error.message);
      return false;
    }
  }
}

// Export health status function for use in health endpoints
export const getEmailHealthStatus = () => EmailCreatedListener.getHealthStatus();
export const testEmailConnectivity = () => EmailCreatedListener.testEmailConnectivity();
