import { readFile } from 'node:fs/promises';

const lock = JSON.parse(
  await readFile(new URL('../../contracts/contract-lock.json', import.meta.url), 'utf8'),
);

const expectedBackendSha = 'c402fa5e82acffd5ac07ee0448b2de83ec600347';
const expectedSpecSha = '9008e605b96660b5183e937b1b15088d5f6faa27';

const errors = [];

if (lock.backend?.release !== 'v0.4.0') errors.push('backend.release must remain v0.4.0');
if (lock.backend?.sha !== expectedBackendSha)
  errors.push('backend.sha does not match locked v0.4.0');
if (lock.auth?.specificationSha !== expectedSpecSha) {
  errors.push('auth.specificationSha does not match locked AUTH-01 specification');
}
if (lock.transport?.apiPrefix !== '/api/v1') errors.push('transport.apiPrefix must be /api/v1');
if (lock.transport?.openApiPath !== '/openapi.json') {
  errors.push('transport.openApiPath must be /openapi.json');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Backend contract lock is valid.');
