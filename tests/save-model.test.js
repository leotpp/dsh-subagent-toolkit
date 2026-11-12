import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const block = source.slice(source.indexOf('const saveModel = useCallback('), source.indexOf('\n      const savePi ='))
const callback = block.slice(block.indexOf('async () =>'), block.lastIndexOf('}, [') + 1)
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end))
const createController = vm.runInNewContext(`(${extract('function createController(ctx)', '\n    return {\n      inject:')})`)
const formSnapshot = vm.runInNewContext(`(${extract('function formSnapshot(form)', '\n    function useForm')})`)
const messages = Object.fromEntries([...source.matchAll(/^      (\w+): '([^']*)',?$/gm)].map(([, key, value]) => [key, value]))
const ns = 'subagent-model-selection-settings'
const route = { provider: 'magpie-responses', model: 'codex/gpt-6.1-sol' }
const clone = value => JSON.parse(JSON.stringify(value))
const initialValue = { enabled: true, allowedModels: [{ provider: 'existing', model: 'stored' }] }
const overlayReason = `Configuration for "${ns}" is overridden by a home patch or command-line overlay`

// Only the transport/form boundary is substituted; controller wiring, snapshot
// access and the entire save callback execute directly from client.js.
function fixture({ status = 'ready', writable = true, missing = false, followMain = false,
  stale = false, rejected = false, callbackSource = callback } = {}) {
  const calls = []
  const observed = []
  const listeners = new Set()
  let modelStatus = ''
  let host = { ns, revision: stale ? 8 : 7, value: clone(initialValue) }
  let snapshot = { status, writable, ...clone(host), revision: 7 }
  const view = () => clone(host)
  const modelsForm = { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) } }
  const settings = { acceptView: accepted => {
    snapshot = { ...snapshot, ...clone(accepted) }
    calls.push({ ns: 'acceptView', view: clone(accepted) })
    for (const listener of listeners) listener()
  } }
  const forms = {
    [ns]: missing ? undefined : modelsForm,
    'subagent-pi': { mutate: async ops => { calls.push({ ns: 'pi', ops }); return true } },
    'llm-pi-ai': { mutate: async ops => { calls.push({ ns: 'llm', ops }); return true } },
  }
  const remote = { settings: {
    mutate: async (namespace, ops, revision) => {
      calls.push({ ns: namespace, ops: clone(ops), revision })
      assert.equal(namespace, ns)
      if (revision !== host.revision) return { ok: false, error: { code: 'settings/conflict', message: `settings namespace "${ns}" changed since it was read (expected revision ${revision}, now ${host.revision})` } }
      if (rejected) return { ok: false, error: { code: 'settings/rejected', message: overlayReason } }
      const value = clone(host.value)
      for (const op of ops) {
        assert.equal(op.op, 'set')
        assert.equal(op.path.length, 1)
        value[op.path[0]] = clone(op.value)
      }
      host = { ns, revision: host.revision + 1, value }
      return { ok: true, value: view() }
    },
    describe: async () => { calls.push({ ns: 'describe' }); return { ok: true, value: { writable, namespaces: [view()] } } },
  } }
  const controller = createController({ remote, configForms: { describe: () => settings, get: key => forms[key] } })
  modelsForm.subscribe(() => observed.push(clone(formSnapshot(controller.modelsForm))))
  const env = {
    Error, controller, formSnapshot,
    selectedRoute: followMain ? '' : `${route.provider}\u0000${route.model}`,
    selectedRouteValue: followMain ? undefined : route,
    selectedProviderConfig: { models: [{ id: route.model, contextWindow: 1000 }] },
    channelModels: [{ id: route.model, name: 'Selected model' }],
    modelContext: '128000', modelMaxTokens: '8192', currentModelEffort: 'medium',
    modelSaving: false,
    setModelSaving: value => { env.modelSaving = value },
    setModelStatus: value => { modelStatus = value },
    t: key => messages[key] ?? key,
    parseRoute: key => { const [provider, model] = key.split('\u0000'); return { provider, model } },
  }
  return { env, calls, observed, save: vm.runInNewContext(`(${callbackSource})`, env),
    get host() { return view() }, get snapshot() { return clone(snapshot) }, get status() { return modelStatus } }
}

function assertAccepted(f, followMain) {
  const expected = { enabled: !followMain, allowedModels: followMain ? [] : [route] }
  assert.deepEqual(f.host.value, expected, 'persisted Host value')
  assert.deepEqual(f.snapshot.value, expected, 'accepted snapshot value')
  assert.equal(f.snapshot.revision, f.host.revision)
  assert.deepEqual(f.observed.at(-1)?.value, expected, 'subscriber observed accepted value')
  assert.equal(f.observed.at(-1)?.revision, f.host.revision)
  assert.equal(f.status, messages.saved)
}

for (const [status, writable, missing, expected] of [
  ['loading', true, false, 'formLoading'],
  ['loading', false, false, 'formLoading'],
  ['unavailable', true, false, 'unavailable'],
  ['ready', true, true, 'unavailable'],
  // Defensive contract; the current native Host reports writable=true.
  ['ready', false, false, 'readOnly'],
]) {
  test(`${status}, writable=${writable}, missing=${missing}: block all executable detail/effort/selection writes`, async () => {
    const f = fixture({ status, writable, missing })
    await f.save()
    assert.equal(f.calls.length, 0)
    assert.equal(f.observed.length, 0)
    assert.deepEqual(f.host.value, initialValue)
    assert.equal(f.status, messages.failed + messages[expected])
  })
}

test('Host settings/rejected preserves the actual overlay reason and accepted stored value', async () => {
  const f = fixture({ rejected: true })
  await f.save()
  assert.equal(f.status, messages.failed + overlayReason)
  assert.deepEqual(f.host.value, initialValue)
  assert.deepEqual(f.snapshot.value, initialValue)
  assert.deepEqual(f.observed.at(-1).value, initialValue)
  assert.equal(f.calls.filter(call => call.ns === ns).length, 1)
})

test('preserve the rejection reason if recovery cannot reach the Host', async () => {
  const f = fixture({ rejected: true })
  f.env.controller.remote.settings.describe = async () => { throw new Error('offline') }
  await f.save()
  assert.equal(f.status, messages.failed + overlayReason)
  assert.deepEqual(f.snapshot.value, initialValue)
  assert.deepEqual(f.host.value, initialValue)
  assert.equal(f.observed.length, 0)
})

test('stale revision keeps stored state, refreshes revision, and only an explicit second click succeeds', async () => {
  const f = fixture({ stale: true })
  await f.save()
  assert.match(f.status, /expected revision 7, now 8/)
  assert.deepEqual(f.host.value, initialValue)
  assert.deepEqual(f.snapshot.value, initialValue)
  assert.equal(f.snapshot.revision, 8)
  assert.deepEqual(f.observed.at(-1).value, initialValue)
  assert.equal(f.calls.filter(call => call.ns === ns).length, 1, 'no automatic retry')
  await f.save()
  assert.deepEqual(f.calls.filter(call => call.ns === ns).map(call => call.revision), [7, 8])
  assertAccepted(f, false)
})

test('an in-progress save does not start another write', async () => {
  const f = fixture()
  f.env.modelSaving = true
  await f.save()
  assert.equal(f.calls.length, 0)
})

test('a failed effort write blocks selection after executing the model-detail path', async () => {
  const f = fixture()
  f.env.controller.piForm.mutate = async ops => { f.calls.push({ ns: 'pi', ops: clone(ops) }); return false }
  await f.save()
  assert.equal(f.status, messages.failed + 'effort write refused')
  assert.deepEqual(f.calls.map(call => call.ns), ['llm', 'pi'])
  assert.deepEqual(f.calls[1].ops, [{ op: 'set', path: ['nativeReasoningEffort'], value: 'medium' }])
  assert.deepEqual(f.host.value, initialValue)
  assert.equal(f.observed.length, 0)
})

test('a failed model-detail write blocks effort and selection', async () => {
  const f = fixture()
  f.env.controller.llmForm.mutate = async () => { f.calls.push({ ns: 'llm' }); return false }
  await f.save()
  assert.equal(f.status, messages.failed + 'model detail write refused')
  assert.deepEqual(f.calls.map(call => call.ns), ['llm'])
  assert.deepEqual(f.host.value, initialValue)
})

for (const followMain of [false, true]) {
  test(`persist ${followMain ? 'follow main' : 'one exact route'} and publish the complete accepted state`, async () => {
    const f = fixture({ followMain })
    await f.save()
    const request = f.calls.find(call => call.ns === ns)
    assert.equal(request.revision, 7)
    assert.deepEqual(request.ops, [
      { op: 'set', path: ['enabled'], value: !followMain },
      { op: 'set', path: ['allowedModels'], value: followMain ? [] : [route] },
    ])
    if (!followMain) {
      assert.deepEqual(f.calls.slice(0, 3).map(call => call.ns), ['llm', 'pi', ns])
      const model = f.calls[0].ops[0].value.models[0]
      assert.equal(model.contextWindow, 128000)
      assert.equal(model.maxTokens, 8192)
    }
    assertAccepted(f, followMain)
  })
}

test('state assertions detect in-memory removal of acceptView and corrupt selection operations', async () => {
  for (const mutated of [
    callback.replace('controller.settings.acceptView(response.value)', 'void response.value'),
    callback.replace('value: allowedModels.length > 0', 'value: false'),
    callback.replace('value: allowedModels }', 'value: [] }'),
  ]) {
    assert.notEqual(mutated, callback)
    const f = fixture({ callbackSource: mutated })
    await f.save()
    assert.throws(() => assertAccepted(f, false), assert.AssertionError)
  }
})
