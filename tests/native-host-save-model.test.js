import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const archive = process.env.DSH_TEST_ASAR || '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const block = source.slice(source.indexOf('const saveModel = useCallback('), source.indexOf('\n      const savePi ='))
const callback = block.slice(block.indexOf('async () =>'), block.lastIndexOf('}, [') + 1)
const ns = 'subagent-model-selection-settings'
const route = { provider: 'test-provider', model: 'test-model' }

// The installed application is read-only. All runtime dependencies and profile
// state stay in a temporary directory; no desktop profile is opened or edited.
function extractRuntime(directory) {
  const bytes = readFileSync(archive)
  const header = JSON.parse(bytes.subarray(16, 16 + bytes.readUInt32LE(12)).toString())
  const dataOffset = 8 + bytes.readUInt32LE(4)
  function walk(node, path) {
    for (const [name, entry] of Object.entries(node.files || {})) {
      const target = join(path, name)
      if (entry.files) walk(entry, target)
      else if (!entry.unpacked && !entry.link && /\.(?:js|mjs|cjs|json)$/.test(name)) {
        mkdirSync(dirname(target), { recursive: true })
        const start = dataOffset + Number(entry.offset)
        writeFileSync(target, bytes.subarray(start, start + entry.size))
      }
    }
  }
  walk(header.files.dsh, directory)
}

// Only the UI store's publication primitive is supplied here. The Mirror,
// ConfigFormController, Host SettingsForms, Cordis fibers and Loader entries
// below execute the installed application's code, not rewritten algorithms.
function createSnapshotStore(initial) {
  let snapshot = initial
  const listeners = new Set()
  const set = next => { snapshot = next; for (const listener of listeners) listener() }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    set,
    update: change => { const draft = { ...snapshot }; change(draft); set(draft) },
  }
}

test('native Host/Loader and shared Mirror: save all namespaces, then rebuild from persisted memory', {
  skip: !existsSync(archive) && 'installed DSH app.asar unavailable; set DSH_TEST_ASAR',
}, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-save-host-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  extractRuntime(directory)
  const nativeRequire = createRequire(join(directory, 'package.json'))
  const { Context } = nativeRequire('@deepseek-ai/cordis')
  const { Loader, EntryGroup } = nativeRequire('@deepseek-ai/cordis-plugin-loader')
  const { SettingsForms } = nativeRequire('@deepseek-ai/dsh-settings')
  const z = nativeRequire('@deepseek-ai/schemastery')
  const { Config: llmSchema } = nativeRequire('@deepseek-ai/dsh-llm-pi-ai')
  const { SubagentModelSelectionConfig } = nativeRequire('@deepseek-ai/dsh-tool-subagent/model-selection-settings')
  const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  const piSchema = vm.runInNewContext(index.slice(index.indexOf('export const Config =') + 'export const Config ='.length, index.indexOf('\n\nfunction readConfig')), { z })
  const schemas = { 'llm-pi-ai': llmSchema, 'subagent-pi': piSchema, [ns]: SubagentModelSelectionConfig.Config }
  const persisted = { 'llm-pi-ai': { providers: { [route.provider]: { baseURL: 'https://example.invalid/v1', api: 'openai-completions', models: [{ id: route.model, name: 'Test' }] } } }, 'subagent-pi': {}, [ns]: {} }
  const traces = []
  const buildHost = async () => {
    const ctx = new Context()
    const loader = new Loader(ctx)
    await ctx.fiber.await()
    // Domain plugin side effects (network/real sessions) are excluded; their
    // actual schemas, config resolution and Loader lifecycle are retained.
    const plugins = Object.fromEntries(Object.entries(schemas).map(([name, Config]) => [name, { Config, apply() {} }]))
    const tree = { ctx, store: {}, ensureId: options => options.id, import: async name => plugins[name], commit() {} }
    const group = new EntryGroup(ctx, tree)
    const rows = () => Object.keys(schemas).map(id => ({ id, name: id, config: structuredClone(persisted[id]) }))
    await group.update(rows())
    await loader.await()
    for (const entry of Object.values(tree.store)) assert.ok(entry.fiber?.uid, `active native fiber: ${entry.id}`)
    ctx.provide('configEditor')
    ctx.set('configEditor', {
      entries: () => Object.values(tree.store),
      configuration: () => Object.values(tree.store).map(entry => ({ entry, inherited: {}, override: structuredClone(persisted[entry.options.id]) })),
      async edit(entry, change) {
        await group.update(rows())
        persisted[entry.options.id] = change(structuredClone(entry.options.config), {})
        await group.update(rows())
        await loader.await()
        ctx.emit('app-boot/config-reload')
      },
    })
    ctx.provide('profileContext')
    ctx.set('profileContext', { home: join(directory, 'absent-profile') })
    const settings = new SettingsForms(ctx)
    t.after(() => ctx.fiber.dispose())
    return { ctx, settings, tree }
  }
  const host = await buildHost()
  const nativeClient = readFileSync(join(directory, 'node_modules/@deepseek-ai/dsh-client-ui-settings/lib/client.js'), 'utf8')
  let factory
  vm.runInNewContext(nativeClient.replace('exports.apply=apply;', 'exports.SettingsDescribeMirror=SettingsDescribeMirror;exports.ConfigFormController=ConfigFormController;exports.apply=apply;'), {
    window: { __ModuleLoader__: { load: module => { factory = module.factory } } }, structuredClone,
  })
  const { SettingsDescribeMirror, ConfigFormController } = factory(name => name === '@deepseek-ai/dsh-client-store' ? { createSnapshotStore } : nativeRequire(name))
  assert.equal(typeof SettingsDescribeMirror, 'function')
  const remote = { settings: {
    describe: async () => ({ ok: true, value: { writable: true, namespaces: host.settings.describe({ redactSecrets: true }), hasDocument: true } }),
    mutate: async (namespace, ops, revision) => {
      try {
        await host.settings.mutate(namespace, ops, revision)
        const value = host.settings.describe({ redactSecrets: true }).find(row => row.ns === namespace)
        traces.push({ namespace, revision, result: value.revision })
        return { ok: true, value }
      } catch (error) {
        traces.push({ namespace, revision, error: error.message })
        return { ok: false, error: { message: error.message } }
      }
    },
  } }
  const mirror = new SettingsDescribeMirror({ remote })
  host.ctx.on('settings/document-updated', () => { void mirror.load() })
  await mirror.ensure()
  const form = namespace => new ConfigFormController({ remote }, { namespace }, mirror, {
    rehydrate: schema => new z(schema), validate: (schema, value) => { try { schema(value) } catch (error) { return error.message } },
  })
  const controller = { remote, settings: mirror, llmForm: form('llm-pi-ai'), piForm: form('subagent-pi'), modelsForm: form(ns) }
  const uids = Object.values(host.tree.store).map(entry => entry.fiber.uid)
  let status
  const env = {
    Error, controller, formSnapshot: form => form?.getSnapshot(), modelSaving: false,
    selectedRoute: `${route.provider}\u0000${route.model}`, selectedRouteValue: route,
    selectedProviderConfig: structuredClone(persisted['llm-pi-ai'].providers[route.provider]),
    channelModels: [], modelContext: '128000', modelMaxTokens: '8192', currentModelEffort: 'high',
    parseRoute: () => route, setModelSaving() {}, setModelStatus: value => { status = value }, t: key => key,
  }
  await vm.runInNewContext(`(${callback})`, env)()
  await mirror.ensure()
  t.diagnostic(JSON.stringify(traces))
  assert.equal(status, 'saved')
  assert.deepEqual(traces.map(row => row.namespace), ['llm-pi-ai', 'subagent-pi', ns])
  assert.deepEqual(Object.values(host.tree.store).map(entry => entry.fiber.uid), uids, 'volatile edits retain native fibers')
  assert.deepEqual(structuredClone(persisted[ns]), { enabled: true, allowedModels: [route] })
  assert.equal(persisted['subagent-pi'].nativeReasoningEffort, 'high')
  assert.equal(persisted['llm-pi-ai'].providers[route.provider].models[0].contextWindow, 128000)
  assert.equal(persisted['llm-pi-ai'].providers[route.provider].models[0].maxTokens, 8192)
  await assert.rejects(host.settings.mutate(ns, [{ op: 'set', path: ['enabled'], value: false }], 0), {
    code: 'SETTINGS_CONFLICT', expected: 0, actual: 1,
  })
  assert.equal(persisted[ns].enabled, true, 'native revision conflict prevents overwriting persisted state')
  await vm.runInNewContext(`(${callback})`, env)()
  await mirror.ensure()
  assert.equal(status, 'saved', 'a second save uses the accepted shared revision')
  assert.ok(traces.every(row => !row.error))
  const restarted = await buildHost()
  const descriptors = restarted.settings.describe()
  const reloaded = descriptors.find(row => row.ns === ns)
  assert.equal(descriptors.find(row => row.ns === 'subagent-pi').value.nativeReasoningEffort, 'high')
  const reloadedModel = descriptors.find(row => row.ns === 'llm-pi-ai').value.providers[route.provider].models[0]
  assert.equal(reloadedModel.contextWindow, 128000)
  assert.equal(reloadedModel.maxTokens, 8192)
  assert.deepEqual(structuredClone(reloaded.value), structuredClone(persisted[ns]), 'new native Host resolves the persisted selection')
  assert.deepEqual(structuredClone(controller.modelsForm.getSnapshot().value), structuredClone(reloaded.value), 'shared Mirror agrees with fresh Host')
})
