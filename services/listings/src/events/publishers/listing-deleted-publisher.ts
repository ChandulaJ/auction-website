import { ListingDeletedEvent, Publisher, Subjects } from '@auction-platform/common';

export class ListingDeletedPublisher extends Publisher<ListingDeletedEvent> {
  subject: Subjects.ListingDeleted = Subjects.ListingDeleted;
}
