import { Publisher, Subjects, UserCreatedEvent } from '@auction-platform/common';

export class UserCreatedPublisher extends Publisher<UserCreatedEvent> {
  subject: Subjects.UserCreated = Subjects.UserCreated;
}
