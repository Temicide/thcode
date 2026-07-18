// Ink UI scaffold (ADR 0020). Renders status row, transcript, prompt composer,
// and the Ctx% placeholder. Dispatches typed intents into CoreApp ONLY —
// no fs/network/child_process imports anywhere under src/ui/.

import { useCallback, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { CoreApp } from '../core/app.js';

interface TranscriptLine {
  readonly who: 'you' | 'thcode' | 'system';
  readonly text: string;
}

export interface AppProps {
  core: CoreApp;
}

/**
 * Render `contextPercent` for the status row (PR-4). Never fabricates a
 * numeric percentage from an unverified capacity — when no verified Typhoon
 * context limit exists, `contextPercent` IS the literal canonical token
 * `'percentage unavailable'` (StatusProjection, AD-28 dimension 4) and it is
 * shown verbatim rather than interpolated into a `Ctx N%` string. Exported
 * so this contract is directly unit-testable without rendering Ink.
 */
export function formatContextPercent(contextPercent: number | 'percentage unavailable'): string {
  return contextPercent === 'percentage unavailable' ? contextPercent : `Ctx ${contextPercent}%`;
}

export function App({ core }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([
    { who: 'system', text: 'thcode prototype — /plan /build /models /permissions /tools /exit' },
  ]);
  const [, forceRender] = useState(0);
  const projection = core.query();
  const status = projection.status;

  const push = useCallback((who: TranscriptLine['who'], text: string) => {
    setLines((prev) => [...prev, { who, text }]);
  }, []);

  const handleCommand = useCallback(
    async (cmd: string): Promise<void> => {
      const [name] = cmd.slice(1).split(/\s+/);
      switch (name) {
        case 'exit':
        case 'quit':
          exit();
          return;
        case 'plan':
          core.setMode('plan');
          push('system', 'Switched to PLAN mode (read-only).');
          return;
        case 'build':
          core.setMode('build');
          push('system', 'Switched to BUILD mode.');
          return;
        case 'models': {
          const models = await core.listModels();
          push('system', ['Models (selection is explicit; no silent fallback):', ...models].join('\n'));
          return;
        }
        case 'permissions':
          // TODO(permission-selector): interactive Permission Selector modal (ADR 0012).
          push(
            'system',
            `Permission Profile: ${core.query().status.permissionProfile}\n` +
              '(Placeholder — interactive Permission Selector is a planned feature.)',
          );
          return;
        default: {
          // Slash commands must use the frozen CoreProtocol grammar so Ink,
          // redirected output, and headless callers observe the same canonical
          // `/context` and `/usage` projections (AD-2 + AD-7).
          const result = core.dispatchCommand(cmd, { hasTty: true });
          const text = [result.stdout, result.stderr].filter(Boolean).join('\n');
          push('system', text || 'Command completed.');
        }
      }
    },
    [core, exit, push],
  );

  const submit = useCallback(async () => {
    const value = input.trim();
    if (!value || busy) return;
    setInput('');
    if (value.startsWith('/')) {
      await handleCommand(value);
      forceRender((n) => n + 1);
      return;
    }
    push('you', value);
    setBusy(true);
    try {
      // Manual/Assisted "ask" outcomes auto-reject in this scaffold; the
      // interactive approval prompt is part of the Permission Selector TODO.
      const reply = await core.runTurn(value, async () => false);
      push('thcode', reply);
    } catch (err) {
      push('system', `Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, core, handleCommand, input, push]);

  useInput((ch, key) => {
    if (key.ctrl && ch === 'c') {
      exit();
      return;
    }
    // Story 2.14 AC #1: Esc cancels an IME preedit / dismisses an overlay
    // without authorizing or changing settings. Mirrors the control-surface
    // contract (src/core/protocol/controlSurface.ts) without crossing the
    // AD-1 UI boundary — the contract is the tested source of truth.
    if (key.escape) {
      if (input.length > 0) setInput('');
      return;
    }
    // Story 2.14 AC #1: Shift+Tab switches Plan/Build ONLY at an idle
    // composer. While a prompt round is in flight the toggle is ignored
    // (deferred, not silently applied). Mirrors the control-surface contract
    // without crossing the AD-1 UI boundary.
    if (key.tab && key.shift) {
      if (busy) return;
      const mode = core.toggleMode();
      push('system', `Work Mode → ${mode.toUpperCase()}`);
      forceRender((n) => n + 1);
      return;
    }
    if (key.return) {
      void submit();
      return;
    }
    if (key.backspace || key.delete) {
      setInput((v) => v.slice(0, -1));
      return;
    }
    if (ch && !key.ctrl && !key.meta && !key.tab) {
      setInput((v) => v + ch);
    }
  });

  const statusRow = useMemo(() => {
    const modeLabel = status.workMode.toUpperCase();
    const profileLabel =
      status.permissionProfile === 'full-access'
        ? 'Full Access'
        : status.permissionProfile.charAt(0).toUpperCase() + status.permissionProfile.slice(1);
    return (
      <Box gap={1}>
        <Text inverse color={status.workMode === 'plan' ? 'cyan' : 'green'}>
          {` ${modeLabel} `}
        </Text>
        <Text color="magenta">[{status.providerId}]</Text>
        <Text color="yellow">[Permissions: {profileLabel}]</Text>
        <Text color={status.healthState === 'available' ? 'green' : 'red'}>[{status.healthState}]</Text>
        <Text dimColor>Shift+Tab: plan/build</Text>
      </Box>
    );
  }, [status.workMode, status.permissionProfile, status.providerId, status.healthState]);

  return (
    <Box flexDirection="column" paddingX={1}>
      {statusRow}
      <Box flexDirection="column" marginTop={1}>
        {lines.slice(-30).map((l, i) => (
          <Text key={i} color={l.who === 'you' ? 'white' : l.who === 'thcode' ? 'green' : 'gray'}>
            {l.who === 'you' ? '> ' : l.who === 'thcode' ? '· ' : '~ '}
            {l.text}
          </Text>
        ))}
        {busy ? <Text color="yellow">… thinking</Text> : null}
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text>
          <Text color="cyan">{'thcode> '}</Text>
          {input}
          <Text inverse> </Text>
        </Text>
        {/* Context Donut textual fallback (ADR 0015). TODO(context-donut):
            segmented Unicode ring + severity colors. PR-4: no verified
            Typhoon context limit ⇒ the literal `percentage unavailable`
            token, never a fabricated `Ctx N%`. */}
        <Text dimColor>{formatContextPercent(status.contextPercent)}</Text>
      </Box>
    </Box>
  );
}
