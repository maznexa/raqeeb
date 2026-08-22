import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  createFolderSchema,
  createProjectSchema,
  createSectionSchema,
  type CreateFolderInput,
  type CreateProjectInput,
  type CreateSectionInput,
} from '@raqeeb/contracts';
import { schema, withTenant } from '@raqeeb/db';
import { and, asc, eq } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { AuditService } from '../platform/audit.service';

const MAX_FOLDER_DEPTH = 5;

function deriveKey(name: string): string {
  const letters = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9\s]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  const key =
    letters.length >= 2
      ? letters.map((w) => w[0]).join('').slice(0, 6)
      : (letters[0] ?? 'PRJ').slice(0, 4);
  return /^[A-Z]/.test(key) ? key : `P${key}`.slice(0, 6);
}

@Controller()
export class ProjectsController {
  constructor(private readonly audit: AuditService) {}

  @Get('projects')
  list(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, (db) =>
      db.select().from(schema.projects).orderBy(asc(schema.projects.position)),
    );
  }

  @Get('projects/:id')
  async get(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    const project = await withTenant(ctx.tenantId, async (db) => {
      const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
      if (!p) return null;
      const sections = await db
        .select()
        .from(schema.sections)
        .where(eq(schema.sections.projectId, id))
        .orderBy(asc(schema.sections.position));
      const statuses = await db
        .select()
        .from(schema.statuses)
        .where(eq(schema.statuses.workflowId, p.workflowId))
        .orderBy(asc(schema.statuses.position));
      return { ...p, sections, statuses };
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  @Post('projects')
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return withTenant(ctx.tenantId, async (db) => {
      const space = await db.query.spaces.findFirst({ where: eq(schema.spaces.id, body.spaceId) });
      if (!space) throw new BadRequestException('Unknown space');

      let workflowId = body.workflowId;
      if (!workflowId) {
        const wf = await db.query.workflows.findFirst({
          where: eq(schema.workflows.isDefault, true),
        });
        if (!wf) throw new BadRequestException('Tenant has no default workflow');
        workflowId = wf.id;
      }

      // Unique project key per tenant; suffix on collision.
      let key = body.key ?? deriveKey(body.name);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await db.query.projects.findFirst({ where: eq(schema.projects.key, key) });
        if (!clash) break;
        key = `${key.slice(0, 5)}${attempt + 2}`;
      }

      const last = await db
        .select({ position: schema.projects.position })
        .from(schema.projects)
        .orderBy(asc(schema.projects.position));
      const [project] = await db
        .insert(schema.projects)
        .values({
          tenantId: ctx.tenantId,
          spaceId: body.spaceId,
          folderId: body.folderId,
          clientId: body.clientId,
          workflowId,
          name: body.name,
          key,
          color: body.color,
          position: generateKeyBetween(last.at(-1)?.position ?? null, null),
        })
        .returning();
      await this.audit.logIn(db, ctx.tenantId, {
        action: 'project.create',
        entityType: 'project',
        entityId: project!.id,
        actorMembershipId: ctx.membershipId,
      });
      return project;
    });
  }

  @Post('folders')
  createFolder(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createFolderSchema)) body: CreateFolderInput,
  ) {
    return withTenant(ctx.tenantId, async (db) => {
      let depth = 1;
      if (body.parentFolderId) {
        const parent = await db.query.folders.findFirst({
          where: and(
            eq(schema.folders.id, body.parentFolderId),
            eq(schema.folders.spaceId, body.spaceId),
          ),
        });
        if (!parent) throw new BadRequestException('Unknown parent folder');
        depth = parent.depth + 1;
        if (depth > MAX_FOLDER_DEPTH) {
          throw new BadRequestException(`Folders can nest at most ${MAX_FOLDER_DEPTH} levels (D1)`);
        }
      }
      const [folder] = await db
        .insert(schema.folders)
        .values({
          tenantId: ctx.tenantId,
          spaceId: body.spaceId,
          parentFolderId: body.parentFolderId,
          name: body.name,
          depth,
          position: generateKeyBetween(null, null),
        })
        .returning();
      return folder;
    });
  }

  @Get('spaces/:spaceId/folders')
  listFolders(@Tenant() ctx: TenantContext, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return withTenant(ctx.tenantId, (db) =>
      db.select().from(schema.folders).where(eq(schema.folders.spaceId, spaceId)),
    );
  }

  @Post('projects/:id/sections')
  createSection(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createSectionSchema)) body: CreateSectionInput,
  ) {
    return withTenant(ctx.tenantId, async (db) => {
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      });
      if (!project) throw new NotFoundException('Project not found');
      const last = await db
        .select({ position: schema.sections.position })
        .from(schema.sections)
        .where(eq(schema.sections.projectId, projectId))
        .orderBy(asc(schema.sections.position));
      const [section] = await db
        .insert(schema.sections)
        .values({
          tenantId: ctx.tenantId,
          projectId,
          name: body.name,
          position: generateKeyBetween(last.at(-1)?.position ?? null, null),
        })
        .returning();
      return section;
    });
  }

  @Get('clients')
  listClients(@Tenant() ctx: TenantContext) {
    return withTenant(ctx.tenantId, (db) => db.select().from(schema.clients));
  }
}
