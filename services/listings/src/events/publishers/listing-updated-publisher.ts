import { ListingUpdatedEvent, Publisher, Subjects } from '@auction-platform/common';

export class ListingUpdatedPublisher extends Publisher<ListingUpdatedEvent> {
  subject: Subjects.ListingUpdated = Subjects.ListingUpdated;
}
