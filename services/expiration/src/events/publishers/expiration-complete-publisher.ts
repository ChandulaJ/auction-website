import { ListingExpiredEvent, Publisher, Subjects } from '@auction-platform/common';

export class ExpirationCompletePublisher extends Publisher<ListingExpiredEvent> {
  subject: Subjects.ListingExpired = Subjects.ListingExpired;
}
