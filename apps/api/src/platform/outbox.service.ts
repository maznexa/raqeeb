import { Injectable } from '@nestjs/common';
import { schema, type Db } from '@raqeeb/db';

/**
 * Transactional outbox writer. Called INSIDE the same withTenant() transaction
 * as the entity change, so an event exists iff the change committed.
 * The worker polls unpublished rows → Redis pub/sub → (P2) Socket.IO rooms & webhooks.
 */
@Injectable()
export class OutboxService {
  async emit(
    db: Db,
    tenantId: string,
    event: {
      eventType: string; // e.g. task.created, task.status_changed
      entityType: string;
      entityId: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    await db.insert(schema.outboxEvents).values({
      tenantId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload ?? {},
    });
  }
}
