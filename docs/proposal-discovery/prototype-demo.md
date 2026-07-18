# Prototype Demonstration

## Accepted service evidence matrix

| AI for Thai category | Selected service | Required evidence |
| --- | --- | --- |
| Language | Named Entity Recognition | Verified live contract test |
| Vision | T-OCR | Verified and demo-certified |
| Conversation | Speech-to-Text | Verified and demo-certified |
| Other | Extract Address | Verified and demo-certified |

Catalog discovery covers every current AI for Thai service. This matrix defines the narrower operational evidence required for Phase 1; it does not imply that other catalogued services are callable.

The Demo Portfolio contains three short, independent scenarios rather than one compound showcase. Each scenario has its own fixture, expected tool call, code change, and verification evidence, and it must remain runnable if either of the other demo services is unavailable.

## Demo Scenario: spoken Express feature request

### Fixture

Use the repository's minimal Express server as the clean starting fixture. It currently exposes only `GET /health`, identifies itself as an ES module, and has no working automated test command. Provide a short Thai audio file named `feature-request.wav` containing:

> เพิ่ม endpoint GET /info ให้คืนชื่อ thcode เวอร์ชัน และสถานะ ready พร้อมเพิ่ม automated test

### Expected sequence

1. The developer references `@feature-request.wav` in Plan Mode.
2. The CLI validates the local audio file, identifies AI for Thai Speech-to-Text as the intended service, and obtains upload consent.
3. Speech-to-Text returns a transcript that is displayed and included as evidence for Typhoon.
4. Typhoon inspects the server rather than assuming its framework, package version, or test setup.
5. Plan Mode proposes the `/info` response, any refactoring needed to test the Express application, a test using Node's built-in test facilities, and the exact verification command.
6. Only after `/build` approval, thcode applies the bounded server changes and runs the test.
7. The final report links the audio hash, transcript, code diff, command output, model, and Speech-to-Text invocation without recording either API key.

### Acceptance criteria

- No audio leaves the workspace before explicit consent.
- The Thai transcript preserves the material requirements: `GET /info`, `thcode`, a version, `ready`, and an automated test.
- No repository file changes in Plan Mode.
- `GET /info` returns JSON containing the name `thcode`, the server package version, and the status `ready`.
- A repeatable automated test covers the endpoint and passes.
- The scenario does not install a third-party test framework.
- Existing `GET /health` behavior remains intact.
- The scenario passes from its clean fixture without depending on either other Demo Scenario.

## Demo Scenario: Thai address preview page

### Fixture

Use a clean copy of the current Next.js client and a file named `sample-address.txt` containing one clearly labelled synthetic Thai address. The fixture must not contain a real customer's or team member's personal information.

### User request

```text
Plan mode

> ใช้ AI for Thai แยกส่วนที่อยู่ใน @sample-address.txt แล้วสร้างหน้า
> /address-preview ที่แสดงข้อความเดิมและข้อมูลที่แยกได้ จากนั้นตรวจว่า build ผ่าน
```

### Expected sequence

1. The CLI resolves `@sample-address.txt` inside the workspace and identifies that address text may be sensitive even though the selected fixture is synthetic.
2. The CLI names AI for Thai Extract Address as the destination and obtains consent before transferring the text.
3. Extract Address returns structured evidence. thcode preserves the original text, returned fields, empty fields, and any reported uncertainty without asking Typhoon to invent missing components.
4. Typhoon inspects the client structure and scripts rather than assuming the framework or page layout.
5. Plan Mode proposes a typed address representation, the `/address-preview` route, affected files, rendering behavior, and `npm run build` verification while remaining read-only.
6. Only after `/build` approval, thcode creates the bounded client changes and runs the existing build command.
7. The final report links the input hash, normalized Extract Address evidence, diff, build output, model, and tool invocation without recording credentials or retaining unrelated address data.

### Acceptance criteria

- The committed demonstration fixture is synthetic and clearly marked as test data.
- No address text leaves the workspace before explicit consent.
- The demo uses the live AI for Thai Extract Address integration; a stub cannot earn Demo-Certified status.
- No repository file changes in Plan Mode.
- `/address-preview` renders the original address and the structured fields returned by the service with clear Thai labels.
- A field absent from the service response is shown as unavailable or omitted; it is never fabricated by Typhoon.
- The address structure has explicit field names and types rather than being an unvalidated free-form object.
- The page remains usable when optional address components are absent.
- Changes are limited to the address fixture, data representation, route, and directly relevant styling or components.
- `npm run build` succeeds from `client/`.
- Failure or refusal of the remote service leaves the clean repository unchanged.
- Neither API key nor unrelated session data appears in source files, logs, reports, or generated UI.
- The scenario passes from its clean fixture without depending on either other Demo Scenario.

## Smoke test: image text to verified program output

### First-run onboarding

```text
$ thcode

Welcome to thcode
Thai-first coding with local tools and Thai AI services.

Choose a reasoning provider
> Typhoon
  Pathumma (unavailable)
  OpenThaiGPT (unavailable)
  THaLLE (unavailable)
```

The Phase 1 prototype uses local BYOK. The Typhoon key is required, stored in the operating system credential store, and used directly by the CLI. AI for Thai is connected separately as an optional external tool provider when its API key is available.

```text
Connect required reasoning provider
> Typhoon API key: ************
  Connection verified

Connect optional Thai service tools
> AI for Thai API key: skip for now
```

### Task

```text
Plan mode

> ช่วยสร้างโปรแกรมที่พิมพ์ข้อความจาก @sample-text.png
```

### Expected sequence

1. The local artifact resolver validates that `sample-text.png` is inside the workspace and is a supported image.
2. The CLI shows the destination service and asks permission before upload.
3. In Phase 1, the local AI for Thai adapter calls OCR directly with the locally stored AI for Thai key. If access is still pending, a labeled development stub may be used for plumbing but cannot be presented as a completed integration.
4. OCR output is normalized, cached by image hash, and returned as evidence.
5. The local Typhoon adapter sends the Thai request, OCR evidence, local tool schemas, and Plan-mode policy directly to Typhoon using the locally stored key.
6. Typhoon returns a typed plan for the selected language, dependency checks, execution, and output comparison.
7. The CLI displays the plan and remains read-only.
8. The user enters `/build` and accepts the required local permissions.
9. thcode creates the program, executes it with the available toolchain, and compares stdout with the normalized OCR text.
10. thcode reports the diff, command results, exact model, AI for Thai tool, and verification status.

### Acceptance criteria

- No image is uploaded before explicit consent.
- OCR output and confidence or uncertainty are visible.
- No file is written in Plan mode.
- The selected runtime or compiler is discovered before Build mode.
- The program builds successfully when compilation is required.
- Program stdout matches the expected normalized text.
- The session audit records provider, model, artifact hash, server tool, local actions, and approvals without recording secrets.

## Why this is only a smoke test

This task proves onboarding, artifact references, remote AI for Thai use, Thai reasoning, plan/build separation, local tool calls, and verification. It does not sufficiently prove repository search, multi-file reasoning, or superiority over OpenCode.

A final competition demonstration should apply the same flow to an existing repository and require the agent to identify and modify the correct files.

## Headline demonstration: existing thcode repository

### Fixture

Use the current thcode repository before the landing-page change:

- `client/src/app/page.tsx` still contains the default Next.js starter interface;
- `thcode_logo.png` exists at the repository root;
- the logo contains stylized `TH CODE` lettering with a red-to-blue gradient;
- the client is a Next.js application with a documented `npm run build` command.

### User request

```text
Plan mode

> ช่วยปรับหน้าแรกของโปรเจกต์นี้ให้ใช้ @thcode_logo.png แทนโลโก้ Next.js
> อธิบายว่า thcode เป็น Thai-first coding agent และตรวจว่า build ผ่าน
```

### Required Plan-mode behavior

1. Resolve `@thcode_logo.png` inside the workspace.
2. Ask permission before sending the image through the Phase 1 local AI for Thai adapter.
3. Call T-OCR with the separately stored AI for Thai key and display normalized text evidence.
4. Inspect the repository manifest without assuming the framework.
5. Identify `client/package.json`, `client/src/app/page.tsx`, relevant styles, and the public asset location.
6. Run dependency preflight for Node.js and npm without mutating the repository.
7. Show the intended asset copy, page edits, affected paths, build command, and risks.
8. Remain read-only until `/build` is explicitly approved.

### Required Build-mode behavior

1. Place the logo in the client asset path through a local file operation.
2. Replace the default Next.js homepage content with a focused thcode landing view.
3. Include concise Thai-first coding-agent positioning without inventing unsupported product claims.
4. Preserve repository boundaries and avoid unrelated server or database changes.
5. Run the existing client build command.
6. If the build fails, inspect the output, make bounded corrections, and re-run it.
7. Report the final diff, build evidence, tools used, model used, and AI for Thai service used.

### Acceptance criteria

- `thcode_logo.png` is used by the homepage from a valid Next.js asset location.
- Default Next.js branding is no longer the primary page content.
- The page accurately describes thcode as a Thai-first coding-agent prototype.
- Only relevant client and asset files are changed.
- `npm run build` succeeds from `client/`.
- The session shows a Plan-mode checkpoint before any file mutation.
- The Typhoon credential never appears in logs, prompts, or hosted-service requests.
- The image is not uploaded before explicit consent.

### Comparison use

Run the same Thai request, repository commit, Typhoon model, and AI for Thai capability against the OpenCode baseline. Compare task success, relevant-file selection, tool calls, context usage, intervention count, and build result.

## Missing-toolchain branch

If the user explicitly requests C++ and no supported compiler is available, Plan mode should stop before proposing execution and show:

```text
Missing capability: C++ compiler
Detected platform: Windows
Checked: cl.exe, clang++.exe, g++.exe

The code can be generated, but it cannot be verified locally yet.
Recommended next step: install one supported compiler, then run /check again.
No software has been installed and no files have been modified.
```

The exact recommendation must be tied to a documented supported toolchain rather than generated from model memory alone.

## Credential rule

The Typhoon and AI for Thai keys must remain in the local operating system credential store. They must never be stored in project files, written to logs, or included in session transcripts. Each key may be sent only to its configured official provider endpoint.
