import type { CommentDto, TaskDto } from '@raqeeb/contracts';

// Client-side view models for API responses. Task/comment shapes come straight
// from @raqeeb/contracts; container rows mirror the API's table selects.

export type Task = TaskDto;
export type Comment = CommentDto;
export type Status = TaskDto['status'];
export type Priority = TaskDto['priority'];

export interface MyTenant {
  tenantId: string;
  name: string;
  slug: string;
  role: string;
}

export interface Space {
  id: string;
  name: string;
  icon: string | null;
  isPrivate: boolean;
}

export interface Project {
  id: string;
  spaceId: string;
  name: string;
  key: string;
  color: string | null;
  clientId: string | null;
}

export interface Section {
  id: string;
  name: string;
}

export interface ProjectDetail extends Project {
  sections: Section[];
  statuses: Status[];
}

export interface Me {
  kind: 'user' | 'pat';
  account?: { id: string; email: string; displayName: string };
}
