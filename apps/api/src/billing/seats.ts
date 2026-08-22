import { schema, systemDb } from '@raqeeb/db';
import { and, count, eq, notInArray } from 'drizzle-orm';

/**
 * THE seat rule (docs/06-saas-commercial/03-billing-stripe.md): count of active
 * memberships with is_billable_seat. Runs on systemDb — billing is a documented
 * cross-tenant escape hatch (packages/db/src/client.ts).
 *
 * The role exclusion is belt-and-braces on top of the flag: clients and guests
 * are structurally free and must NEVER count, even if a write path ever
 * mis-sets is_billable_seat.
 */
export async function countBillableSeats(tenantId: string): Promise<number> {
  const [row] = await systemDb()
    .select({ n: count() })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.tenantId, tenantId),
        eq(schema.memberships.isBillableSeat, true),
        eq(schema.memberships.status, 'active'),
        notInArray(schema.memberships.role, ['guest', 'client']),
      ),
    );
  return row?.n ?? 0;
}
