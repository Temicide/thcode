# ADR 0019: npm Is the Canonical CLI Distribution

- Status: Accepted
- Date: 12 July 2026
- Decision owner: Applicant

thcode ships as a global npm CLI package rather than a standalone Windows executable. The preferred unscoped package name is `thcode`, which returned no existing package in the npm registry check on 12 July 2026. The Windows-first prototype is installed with `npm install -g thcode` and exposes the `thcode` executable through the package's `bin` entry. macOS and Linux later use the same package and command with platform-specific shell, path, credential-store, and process adapters.

Node.js is therefore an installation prerequisite for thcode itself, not merely a project toolchain that thcode can detect after startup. The installer documentation or an optional bootstrap checker must report a missing or unsupported Node.js version clearly; thcode must not claim that it can repair a prerequisite before it can run.

The prototype supports Node.js 22 or newer, with Node.js 24 LTS as the clean-machine competition baseline. It does not rely on Node.js 26-only features. Node.js 20 and earlier are rejected with a clear version and installation message because those lines are outside the accepted support baseline.

The prototype does not maintain a parallel `.exe` distribution. A self-contained executable or native installer may be reconsidered for the later non-developer product, but it is outside the competition scope. If publication of the unscoped name fails, an organization-scoped package such as `@thcode/cli` is the fallback while preserving the `thcode` bin command.

## Consequences

- One package architecture can expand to all three target platforms.
- Developer installation and updates use familiar npm workflows.
- Clean-machine testing must begin with the documented Node.js prerequisite.
- The package declares and checks its Node.js engine range; the release checklist tests global install, startup, and uninstall on Node.js 24 LTS.
- npm lifecycle-script risk, dependency integrity, version pinning, and uninstall behavior become part of the security and release design.
