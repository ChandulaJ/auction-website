import { BidCreatedEvent, Publisher, Subjects } from '@auction-platform/common';

export class BidCreatedPublisher extends Publisher<BidCreatedEvent> {
  subject: Subjects.BidCreated = Subjects.BidCreated;
}
