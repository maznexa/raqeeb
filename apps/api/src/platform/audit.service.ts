import { Injectable } from '@nestjs/common';
import { schema, withTenant, type Db } from '@raqeeb/db';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  actorMembershipId?: string;
  actorType?: 'user' | 'api' | 'system';
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  /** Write inside an existing tenant transaction (preferred — atomic with the change). */
  async logIn(db: Db, tenantId: string, entry: AuditEntry): Promise<void> {
    await db.insert(schema.auditLogs).values({
      tenantId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorMembershipId: entry.actorMembershipId,
      actorType: entry.actorType ?? 'user',
      metadata: entry.metadata ?? {},
    });
  }

  /** Fire-and-forget variant for paths without an open transaction. */
  log(tenantId: string, entry: AuditEntry): void {
    void withTenant(tenantId, (db) => this.logIn(db, tenantId, entry)).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[audit] write failed:', err);
    });
  }
}
