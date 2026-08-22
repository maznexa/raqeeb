import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  addTaskLocationSchema,
  createDependencySchema,
  createTaskSchema,
  moveTaskSchema,
  setAssigneesSchema,
  updateTaskSchema,
  type AddTaskLocationInput,
  type CreateDependencyInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type SetAssigneesInput,
  type UpdateTaskInput,
} from '@raqeeb/contracts';
import { Tenant, type TenantContext } from '../auth/decorators';
import { ZodValidationPipe } from '../core/zod.pipe';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('tasks')
  create(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasks.create(ctx, body);
  }

  @Get('projects/:projectId/tasks')
  listByProject(@Tenant() ctx: TenantContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.tasks.listByProject(ctx, projectId);
  }

  @Get('tasks/:id')
  get(@Tenant() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.get(ctx, id);
  }

  @Patch('tasks/:id')
  update(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.tasks.update(ctx, id, body);
  }

  @Post('tasks/:id/move')
  move(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(moveTaskSchema)) body: MoveTaskInput,
  ) {
    return this.tasks.move(ctx, id, body);
  }

  @Post('tasks/:id/locations')
  addLocation(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addTaskLocationSchema)) body: AddTaskLocationInput,
  ) {
    return this.tasks.addLocation(ctx, id, body);
  }

  @Post('tasks/:id/assignees')
  setAssignees(
    @Tenant() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setAssigneesSchema)) body: SetAssigneesInput,
  ) {
    return this.tasks.setAssignees(ctx, id, body.assigneeMembershipIds);
  }

  @Post('task-dependencies')
  addDependency(
    @Tenant() ctx: TenantContext,
    @Body(new ZodValidationPipe(createDependencySchema)) body: CreateDependencyInput,
  ) {
    return this.tasks.addDependency(ctx, body);
  }
}
