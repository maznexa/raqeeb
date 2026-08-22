import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Problem-details-style error envelope (RFC 9457 flavored):
 * { status, title, detail?, errors? } — stable shape for API consumers.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string'
          ? { status, title: body }
          : { status, title: (body as { message?: string }).message ?? exception.message, ...(body as object) };
      res.status(status).type('application/problem+json').json(payload);
      return;
    }

    console.error('Unhandled exception:', exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type('application/problem+json')
      .json({ status: 500, title: 'Internal Server Error' });
  }
}
