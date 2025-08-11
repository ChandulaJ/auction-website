import { BidDeletedEvent, Publisher, Subjects } from '@auction-platform/common';

export class BidDeletedPublisher extends Publisher<BidDeletedEvent> {
  subject: Subjects.BidDeleted = Subjects.BidDeleted;
}
