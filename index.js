/**
 * dsh-subagent-toolkit — host half.
 *
 * Registers a one-shot `pi-cli` subagent provider that runs the official Pi
 * CLI in non-interactive mode. The CLI is deliberately isolated from Pi
 * Desktop: no AGENTS.md discovery, no extension discovery (which would load
 * @tintinweb/pi-subagents), and no MCP servers. It therefore cannot invoke
 * PI Desktop's Maker/main-coder secondary delegation or `codex exec`.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'

const NO_START_CAPABILITIES = Object.freeze({
  agentOptions: false,
  agentPreset: false,
  outputSchema: false,
  depthLimit: false,
})

const MAX_DIAGNOSTIC_BYTES = 4096

/** User-editable defaults for the pure Pi CLI provider. */
export const Config = z.object({
  providerName: z.string().default('pi-cli'),
  binPath: z.string().default('pi').volatile(),
  provider: z.string().default('magpie').volatile(),
  model: z.string().default('').volatile(),
  nativeReasoningEffort: z.string().default('').volatile(),
  tools: z.string().default('read,bash,edit,write').volatile(),
  agentDir: z.string().default('').volatile(),
})

function readConfig(value, fallback) {
  if (value === undefined || value === null) return fallback
  return typeof value.get === 'function' ? value.get() : value
}

function truncateDiagnostic(text) {
  if (typeof text !== 'string') return undefined
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= MAX_DIAGNOSTIC_BYTES) return text
  return `${bytes.subarray(0, MAX_DIAGNOSTIC_BYTES - 24).toString('utf8')}\n[diagnostic truncated]`
}

function textTask(prompt) {
  if (!Array.isArray(prompt) || prompt.length === 0) {
    throw new Error('subagent-pi: the one-shot task must contain only text blocks')
  }
  const texts = []
  for (const block of prompt) {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') {
      throw new Error('subagent-pi: the one-shot task must contain only text blocks')
    }
    texts.push(block.text)
  }
  if (texts.every(text => text.trim().length === 0)) {
    throw new Error('subagent-pi: the one-shot task must not be empty')
  }
  return texts.join('\n')
}

function assertUsableCwd(cwd) {
  if (typeof cwd !== 'string' || !cwd.startsWith('/')) {
    throw new Error(`subagent-pi: child cwd must be an absolute path: ${String(cwd)}`)
  }
  try {
    if (!statSync(cwd).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new Error(`subagent-pi: child cwd is not an accessible directory: ${cwd}`)
  }
  return cwd
}

class PiCliProvider {
  constructor(name, config) {
    this.name = name
    this.config = config ?? {}
    this.capabilities = NO_START_CAPABILITIES
    this.inheritsParentContext = false
  }

  async start(request) {
    if (request.signal?.aborted) {
      throw new Error('subagent-pi: request was aborted before the Pi CLI child started')
    }
    const cwd = assertUsableCwd(request.cwd)
    const prompt = textTask(request.prompt)
    const binPath = readConfig(this.config.binPath, '') || process.env.PI_CLI_BIN || 'pi'
    const args = ['--print', '--no-session', '--no-context-files', '--no-extensions', '--no-mcp', '--no-skills']
    const provider = readConfig(this.config.provider, '')
    const model = readConfig(this.config.model, '')
    const tools = readConfig(this.config.tools, '')
    if (provider) args.push('--provider', String(provider))
    if (model) args.push('--model', String(model))
    if (tools) args.push('--tools', String(tools))
    if (this.config.extraArgs && Array.isArray(this.config.extraArgs)) {
      args.push(...this.config.extraArgs.map(String))
    }
    args.push('--', prompt)

    const env = { ...process.env, ...(this.config.env ?? {}) }
    const agentDir = readConfig(this.config.agentDir, '')
    if (agentDir) env.PI_CODING_AGENT_DIR = String(agentDir)

    let child
    try {
      child = spawn(binPath, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      throw new Error(`subagent-pi: failed to start ${binPath}: ${error instanceof Error ? error.message : String(error)}`)
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    let stdout = ''
    let stderr = ''
    let cancelled = false
    let settled = false
    let closeResolve
    const closed = new Promise(resolve => { closeResolve = resolve })
    let killTimer

    const settle = (stopReason, diagnostic) => {
      if (settled) return
      settled = true
      if (killTimer) clearTimeout(killTimer)
      request.signal?.removeEventListener?.('abort', onAbort)
      const output = stopReason === 'completed' && stdout.trim().length > 0
        ? [{ type: 'text', text: stdout.trim() }]
        : []
      resolveResult({ output, stopReason, ...(diagnostic === undefined ? {} : { diagnostic: truncateDiagnostic(diagnostic) }) })
    }

    let resolveResult
    const result = new Promise(resolve => { resolveResult = resolve })

    const onAbort = () => {
      cancelled = true
      try { child.kill('SIGTERM') } catch {}
      killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 2000)
      killTimer.unref?.()
    }

    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', error => {
      settle('error', `subagent-pi: failed to run ${binPath}: ${error instanceof Error ? error.message : String(error)}`)
    })
    child.once('close', (code, signal) => {
      closeResolve()
      if (cancelled) {
        settle('aborted')
      } else if (code === 0 && stdout.trim().length > 0) {
        settle('completed')
      } else {
        const detail = stderr.trim()
        settle('error', `subagent-pi: Pi CLI exited ${code === null ? 'by signal' : `with code ${code}`}${signal ? ` (${signal})` : ''}${detail ? `: ${detail}` : ''}`)
      }
    })
    request.signal?.addEventListener?.('abort', onAbort, { once: true })

    let disposal
    const run = {
      id: randomUUID(),
      result,
      dispose() {
        if (disposal) return disposal
        disposal = (async () => {
          if (!settled) {
            cancelled = true
            try { child.kill('SIGTERM') } catch {}
            killTimer = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, 2000)
            killTimer.unref?.()
          }
          await closed
        })()
        return disposal
      },
    }
    return run
  }
}

export const name = 'subagent-pi'

export const inject = ['subagents', 'settings', 'systemPrompt']

export function apply(ctx, config = {}) {
  const providerName = readConfig(config.providerName, '') || 'pi-cli'
  const provider = new PiCliProvider(providerName, config)
  ctx.subagents.registerProvider(provider)

  // The native subagent tool only receives a policy allowlist. When that list
  // has been collapsed to exactly one route, remind the model to pass it so a
  // fresh DSH session uses the single selected "subagent model".
  if (ctx.systemPrompt?.section && ctx.settings?.describe) ctx.effect(() => ctx.systemPrompt.section({
    name: 'subagent-toolkit:single-route',
    order: ctx.systemPrompt.getSectionOrder('TOOL_SUBAGENT') + 1,
    text: () => {
      try {
        const descriptor = ctx.settings.describe().find(row => row.ns === 'subagent-model-selection-settings')
        const value = descriptor?.value
        if (value?.enabled === true && Array.isArray(value.allowedModels) && value.allowedModels.length === 1) {
          const route = value.allowedModels[0]
          const effort = readConfig(config.nativeReasoningEffort, '')
          const effortHint = effort ? ` and reasoning_effort "${effort}"` : ''
          return `When you delegate with the subagent tool, pass provider "${route.provider}" and model "${route.model}"${effortHint} unless the user explicitly asks for a different model or effort.`
        }
      } catch {}
      return ''
    },
  }), 'subagent-toolkit: single-route guidance')
}
