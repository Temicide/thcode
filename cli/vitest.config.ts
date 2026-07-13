import { defineConfig } from 'vitest/config';

// Tests run fully offline and require no real credentials. They cover the
// headless core only (no Ink rendering): permission matrix, workspace
// boundary, catalog manifest, provider registry, and the CredentialStore
// interface via an in-memory fake.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
});
