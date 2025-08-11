import { ListingCreatedEvent, Publisher, Subjects } from '@auction-platform/common';

export class ListingCreatedPublisher extends Publisher<ListingCreatedEvent> {
  subject: Subjects.ListingCreated = Subjects.ListingCreated;
}
