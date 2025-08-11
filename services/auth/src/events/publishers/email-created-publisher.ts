import { EmailCreatedEvent, Publisher, Subjects } from '@auction-platform/common';

export class EmailCreatedPublisher extends Publisher<EmailCreatedEvent> {
  subject: Subjects.EmailCreated = Subjects.EmailCreated;
}
