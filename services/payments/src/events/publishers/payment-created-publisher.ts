import { PaymentCreatedEvent, Publisher, Subjects } from '@auction-platform/common';

export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
  subject: Subjects.PaymentCreated = Subjects.PaymentCreated;
}
