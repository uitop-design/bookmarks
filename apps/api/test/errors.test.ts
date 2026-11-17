import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Prisma } from '../src/generated/prisma/client.js';
import { HttpError } from '../src/lib/http-error.js';
import { errorsPlugin } from '../src/plugins/errors.js';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma failure ${code}`, {
    code,
    clientVersion: '7.10.1',
  });
}

const app = Fastify({ logger: false, bodyLimit: 1024 }).withTypeProvider<ZodTypeProvider>();

beforeAll(async () => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(errorsPlugin);
  app.post(
    '/items/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        querystring: z.object({ limit: z.coerce.number().int().max(10).optional() }),
        body: z.strictObject({ name: z.string().min(1), tags: z.array(z.string()).optional() }),
      },
    },
    () => ({ ok: true }),
  );
  app.get('/http-error', () => {
    throw new HttpError(409, 'Already exists');
  });
  app.get('/prisma/:code', (request) => {
    throw prismaError((request.params as { code: string }).code);
  });
  app.get('/boom', () => {
    throw new Error('secret connection string postgres://user:pass@db');
  });
  await app.ready();
});

afterAll(() => app.close());

const ID = '7f1c9a52-0d7e-4a51-9c63-2a1b3f1d9e10';

function expectErrorBody(body: unknown, statusCode: number, error: string, path: string) {
  expect(body).toEqual({
    statusCode,
    error,
    message: expect.anything(),
    path,
    timestamp: expect.any(String),
  });
  expect(Number.isNaN(Date.parse((body as { timestamp: string }).timestamp))).toBe(false);
}

describe('error handler', () => {
  it('lists validation errors as "field: message"', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/items/not-a-uuid?limit=50',
      payload: { name: '', tags: [1], extra: true },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expectErrorBody(body, 400, 'Bad Request', '/items/not-a-uuid');
    expect(body.message).toEqual([expect.stringMatching(/^id: /)]);
  });

  it('reports every body issue with its path', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/items/${ID}`,
      payload: { name: '', tags: [1], extra: true },
    });
    const { message } = response.json();
    expect(message).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^name: /),
        expect.stringMatching(/^tags\.0: /),
        expect.stringMatching(/^body: Unrecognized key/),
      ]),
    );
  });

  it('formats query validation errors', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/items/${ID}?limit=50`,
      payload: { name: 'x' },
    });
    expect(response.json().message).toEqual([expect.stringMatching(/^limit: /)]);
  });

  it('formats malformed json', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/items/${ID}`,
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expect(response.statusCode).toBe(400);
    expectErrorBody(response.json(), 400, 'Bad Request', `/items/${ID}`);
  });

  it('formats oversized bodies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/items/${ID}`,
      payload: { name: 'x'.repeat(2048) },
    });
    expect(response.statusCode).toBe(413);
    expectErrorBody(response.json(), 413, 'Payload Too Large', `/items/${ID}`);
  });

  it('formats unsupported content types', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/items/${ID}`,
      headers: { 'content-type': 'application/xml' },
      payload: '<name/>',
    });
    expect(response.statusCode).toBe(415);
    expectErrorBody(response.json(), 415, 'Unsupported Media Type', `/items/${ID}`);
  });

  it('uses the status and message of HttpError', async () => {
    const response = await app.inject({ method: 'GET', url: '/http-error' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'Conflict', message: 'Already exists' });
  });

  it.each([
    ['P2002', 409, 'Conflict'],
    ['P2025', 404, 'Not Found'],
    ['P2003', 400, 'Bad Request'],
    ['P2010', 500, 'Internal Server Error'],
  ])('maps prisma %s to %i', async (code, statusCode, error) => {
    const response = await app.inject({ method: 'GET', url: `/prisma/${code}` });
    expect(response.statusCode).toBe(statusCode);
    expectErrorBody(response.json(), statusCode, error, `/prisma/${code}`);
    expect(response.json().message).not.toContain('Prisma failure');
  });

  it('hides details of unexpected errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom?x=1' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      path: '/boom',
    });
    expect(response.body).not.toContain('postgres://');
  });

  it('formats unknown routes', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/missing?q=1' });
    expect(response.statusCode).toBe(404);
    expectErrorBody(response.json(), 404, 'Not Found', '/missing');
    expect(response.json().message).toBe('Route DELETE /missing not found');
  });
});
