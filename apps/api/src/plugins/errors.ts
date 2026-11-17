import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { Prisma } from '../generated/prisma/client.js';
import type { ErrorBody } from '../lib/error-schema.js';
import { HttpError } from '../lib/http-error.js';

interface ResolvedError {
  statusCode: number;
  message: string | string[];
}

const INTERNAL_ERROR: ResolvedError = { statusCode: 500, message: 'Internal server error' };

const prismaErrors: Record<string, ResolvedError> = {
  P2002: { statusCode: 409, message: 'Resource already exists' },
  P2025: { statusCode: 404, message: 'Resource not found' },
  P2003: { statusCode: 400, message: 'Referenced resource does not exist' },
};

function formatValidationIssue(context: string | undefined, path: string, message: string) {
  const field = path.split('/').filter(Boolean).join('.');
  return `${field || context || 'request'}: ${message}`;
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

export function resolveError(error: unknown): ResolvedError {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return {
      statusCode: 400,
      message: error.validation.map((issue) =>
        formatValidationIssue(error.validationContext, issue.instancePath, issue.message ?? ''),
      ),
    };
  }
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return prismaErrors[error.code] ?? INTERNAL_ERROR;
  }
  const statusCode = clientErrorStatus(error);
  if (statusCode !== undefined && error instanceof Error) {
    return { statusCode, message: error.message };
  }
  return INTERNAL_ERROR;
}

export function buildErrorBody(
  request: FastifyRequest,
  { statusCode, message }: ResolvedError,
): ErrorBody {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    path: request.url.split('?', 1)[0] ?? request.url,
    timestamp: new Date().toISOString(),
  };
}

export const errorsPlugin = fp(
  async (app) => {
    app.setErrorHandler<FastifyError>((error, request, reply) => {
      const resolved = resolveError(error);
      if (resolved.statusCode >= 500) {
        request.log.error({ err: error }, 'Unhandled error');
      }
      return reply.code(resolved.statusCode).send(buildErrorBody(request, resolved));
    });

    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?', 1)[0] ?? request.url;
      return reply.code(404).send(
        buildErrorBody(request, {
          statusCode: 404,
          message: `Route ${request.method} ${path} not found`,
        }),
      );
    });
  },
  { name: 'errors' },
);
