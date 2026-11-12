/**
 * dsh-subagent-toolkit — browser half.
 *
 * A Settings → Subagent page with one linear flow:
 *   channel → fetch models → choose one model (or follow the main model).
 *
 * It also keeps the optional pure Pi CLI runner in an advanced section.
 */

window.__ModuleLoader__.load({
  id: 'dsh-subagent-toolkit',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useState } = React
    const h = React.createElement
    const NS = 'settings.subagentToolkit'
    const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

    const en = {
      nav: 'Subagent',
      title: 'Subagent',
      intro: 'Choose the model used by subagents. The default follows the main model.',
      currentLabel: 'Current subagent',
      currentFollow: 'Follows the main model',
      currentFixed: 'Fixed model',
      currentMixed: 'Legacy allowlist',
      defaultBadge: 'Default',
      chooseChannel: 'Choose a channel',
      currentMixedHint: 'The old configuration contains several models. Choose one below and save to collapse it.',
      mainModel: 'Main model',
      channelTitle: 'Channel',
      channelDescription: 'Choose where the subagent model comes from.',
      channel: 'Channel',
      baseUrl: 'Base URL',
      apiKey: 'API key',
      apiKeyStored: 'Configured — leave blank',
      saveChannel: 'Save channel',
      fetchModels: 'Fetch models',
      fetching: 'Fetching…',
      officialChannel: 'The official DeepSeek Account channel needs no URL or API key.',
      customChannel: 'Add an OpenAI-compatible channel',
      customChannelHint: 'For gateways that speak the OpenAI API. Save it once and it becomes a normal channel.',
      routeId: 'Route id',
      displayName: 'Display name',
      protocol: 'Protocol',
      contextWindow: 'Context window',
      maxTokens: 'Max output tokens',
      efforts: 'Reasoning efforts',
      modelTitle: 'Model',
      modelDescription: 'Pick one model. No selection follows the main model.',
      followMain: 'Follow the main model',
      followMainHint: 'Use the same model as the main agent',
      saveModel: 'Save subagent model',
      modelSettingsHint: 'Context window, max output tokens and default thinking effort for this model.',
      modelSettingsUnavailable: 'This channel manages its model details elsewhere.',
      effortUnsupported: 'This model does not expose adjustable thinking levels.',
      selected: 'Selected',
      modelsEmpty: 'No models found on this channel. Fetch models first.',
      modelsFetched: 'Models fetched',
      piTitle: 'Advanced',
      piDescription: 'Optional pure Pi CLI runner. It never loads PI Desktop’s Maker or codex exec.',
      piToggle: 'Configure pure Pi CLI runner',
      piProvider: 'Pi provider',
      piModel: 'Pi model',
      piEffort: 'Thinking effort',
      effort: 'Thinking effort',
      effortDefaultShort: 'Default',
      defaultEffort: 'Provider default',
      piDefault: 'Pi CLI default',
      savePi: 'Save Pi CLI model',
      saved: 'Saved',
      failed: 'Something went wrong: ',
      unavailable: 'Native subagent settings have not loaded. Check that DSH and the official plugin packages use matching versions, then restart DSH; a version mismatch is one possible cause.',
      formLoading: 'Settings are still loading. Try again in a moment.',
      readOnly: 'This deployment stores settings read-only.',
      writeRefused: 'The host refused the write. Discard any draft on the official Subagent page and try again.',
      noCatalog: 'No model catalog yet. Configure a channel first.',
      loading: 'Loading models…',
      routeInvalid: 'Use lowercase letters, digits and hyphens for the route id.',
      channelExists: 'That route id already exists.',
      customSaved: 'Channel saved',
      channelSaved: 'Channel saved',
      apiKeyRequired: 'Enter an API key or leave the existing one in place.',
    }
    const zh = {
      nav: '子模型',
      title: '子模型',
      intro: '选择子代理使用的模型。默认跟随主模型。',
      currentLabel: '当前子模型',
      currentFollow: '跟随主模型',
      currentFixed: '已指定模型',
      currentMixed: '旧配置',
      defaultBadge: '默认',
      chooseChannel: '选择渠道',
      currentMixedHint: '旧的配置里包含多个模型。在下方选一个并保存，就会收敛为一个。',
      mainModel: '主模型',
      channelTitle: '渠道',
      channelDescription: '选择子代理的模型来源。',
      channel: '渠道',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      apiKeyStored: '已配置，留空不修改',
      saveChannel: '保存渠道',
      fetchModels: '获取模型',
      fetching: '获取中…',
      officialChannel: '官方 DeepSeek Account 渠道不需要 URL 或 API Key。',
      customChannel: '添加 OpenAI 兼容渠道',
      customChannelHint: '适用于兼容 OpenAI API 的网关。保存后它会成为普通渠道。',
      routeId: '路由 ID',
      displayName: '显示名称',
      protocol: '协议',
      contextWindow: '上下文窗口',
      maxTokens: '最大输出 tokens',
      efforts: '思考强度',
      modelTitle: '模型',
      modelDescription: '只选一个模型；不选则跟随主模型。',
      followMain: '跟随主模型',
      followMainHint: '和主 Agent 使用同一个模型',
      saveModel: '保存子模型',
      modelSettingsHint: '这个模型的上下文窗口、最大输出和默认思考强度。',
      modelSettingsUnavailable: '这个渠道的模型参数由它自己的设置管理。',
      effortUnsupported: '这个模型没有可调节的思考强度。',
      selected: '已选',
      modelsEmpty: '这个渠道还没有模型，先获取模型。',
      modelsFetched: '模型已获取',
      piTitle: '高级',
      piDescription: '可选的纯 Pi CLI 运行器，不经过 PI Desktop 的 Maker。',
      piToggle: '配置纯 Pi CLI 运行器',
      piProvider: 'Pi 渠道',
      piModel: 'Pi 模型',
      piEffort: '思考强度',
      effort: '思考强度',
      effortDefaultShort: '默认',
      defaultEffort: '渠道默认',
      piDefault: 'Pi CLI 默认',
      savePi: '保存 Pi CLI 模型',
      saved: '已保存',
      failed: '保存失败：',
      unavailable: '原生子模型设置未加载。请检查 DSH 与官方插件包版本是否一致，然后重启 DSH；版本不一致只是可能原因之一。',
      formLoading: '设置仍在加载，请稍后重试。',
      readOnly: '当前部署的设置为只读，无法保存。',
      writeRefused: 'Host 拒绝了设置写入，请刷新设置后重试。',
      noCatalog: '暂时没有模型目录，请先配置渠道。',
      loading: '正在加载模型…',
      routeInvalid: '路由 ID 只能使用小写字母、数字和连字符。',
      channelExists: '这个路由 ID 已存在。',
      customSaved: '渠道已保存',
      channelSaved: '渠道已保存',
      apiKeyRequired: '请输入 API Key，或保留已配置的值。',
    }

    function formSnapshot(form) {
      try { return form?.getSnapshot?.() } catch { return undefined }
    }
    function useForm(form) {
      const [snap, setSnap] = useState(() => formSnapshot(form))
      useEffect(() => {
        if (!form?.subscribe) return undefined
        setSnap(formSnapshot(form))
        return form.subscribe(() => setSnap(formSnapshot(form)))
      }, [form])
      return snap
    }
    function useCatalog(remote) {
      const [state, setState] = useState({ status: 'loading', groups: [], failures: [], default: undefined })
      const load = useCallback(async () => {
        setState(current => ({ ...current, status: 'loading' }))
        try {
          const response = await remote.session.modelCatalog()
          if (!response.ok) throw new Error(response.error?.message || 'model catalog unavailable')
          setState({
            status: 'ready',
            groups: response.value.groups || [],
            failures: response.value.failures || [],
            default: response.value.default,
          })
        } catch (error) {
          setState({ status: 'error', groups: [], failures: [], default: undefined, error: error instanceof Error ? error.message : String(error) })
        }
      }, [remote])
      useEffect(() => { void load() }, [load])
      return { ...state, reload: load }
    }
    function keyOf(provider, model) { return `${provider}\u0000${model}` }
    function parseRoute(key) {
      const [provider, model] = key.split('\u0000')
      return { provider, model }
    }
    function parseEffort(model) {
      const match = /^(.*):(off|low|medium|high|xhigh|max)$/.exec(model || '')
      return match ? { model: match[1], effort: match[2] } : { model: model || '', effort: '' }
    }
    function routeLabel(provider, model, groups) {
      const group = groups.find(item => item.id === provider)
      const found = group?.models.find(item => item.id === model)
      return found?.name || model
    }
    function Field(props) {
      return h('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: props.width || 0, flex: props.flex || '0 1 auto' } },
        h('span', { style: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-text-secondary, #666)' } }, props.label),
        props.children,
        props.hint ? h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-tertiary, #888)' } }, props.hint) : null,
      )
    }
    function Button(props) {
      return h('button', {
        ...props,
        type: 'button',
        disabled: props.disabled,
        style: {
          minHeight: 34,
          padding: '6px 13px',
          borderRadius: 8,
          border: props.primary ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.32))',
          background: props.primary ? 'var(--dsw-alias-fill-accent, #4f46e5)' : 'transparent',
          color: props.primary ? '#fff' : 'inherit',
          font: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: props.disabled ? 'default' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
          ...(props.style || {}),
        },
      }, props.children)
    }
    function SectionRow(props) {
      return h('section', {
        style: {
          display: 'flex', flexWrap: 'wrap', gap: '20px 28px',
          padding: '24px 0 26px',
          borderTop: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.2))',
        },
      },
        h('div', { style: { flex: '0 0 220px', minWidth: 0 } },
          h('h3', { style: { margin: 0, fontSize: 15, fontWeight: 600 } }, props.title),
          h('p', { style: { margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--dsw-alias-text-secondary, #666)' } }, props.description),
        ),
        h('div', { style: { flex: '1 1 520px', minWidth: 0 } }, props.children),
      )
    }
    function StatusPill(props) {
      return h('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '0 8px', borderRadius: 999,
          fontSize: 12, fontWeight: 600,
          background: props.tone === 'active' ? 'var(--dsw-alias-fill-accent-soft, rgba(79,70,229,.14))' : 'var(--dsw-alias-bg-l2, rgba(127,127,127,.12))',
          color: props.tone === 'active' ? 'var(--dsw-alias-text-accent, #4f46e5)' : 'var(--dsw-alias-text-secondary, #666)',
        },
      }, props.children)
    }

    function SubagentPage(props) {
      const { t, controller } = props
      const modelsSnap = useForm(controller.modelsForm)
      const piSnap = useForm(controller.piForm)
      const llmSnap = useForm(controller.llmForm)
      const catalog = useCatalog(controller.remote)

      const providerConfigs = llmSnap?.value?.providers || {}
      function resolveModelProvider(modelId, preferredProvider) {
        if (providerConfigs[preferredProvider]?.models?.some(model => model.id === modelId)) return preferredProvider
        return Object.entries(providerConfigs).find(([, config]) => config?.models?.some(model => model.id === modelId))?.[0] || preferredProvider
      }
      function resolveRoute(route) {
        return { ...route, provider: resolveModelProvider(route.model, route.provider) }
      }
      const savedRoutes = modelsSnap?.value?.allowedModels || []
      const currentRoute = savedRoutes.length === 1 ? resolveRoute(savedRoutes[0]) : undefined
      const savedRouteKey = currentRoute ? keyOf(currentRoute.provider, currentRoute.model) : ''
      const legacyCount = savedRoutes.length > 1 ? savedRoutes.length : 0
      const [selectedRoute, setSelectedRoute] = useState(savedRouteKey)

      const [channelId, setChannelId] = useState('')
      const [channelBaseURL, setChannelBaseURL] = useState('')
      const [channelApiKey, setChannelApiKey] = useState('')
      const [channelBusy, setChannelBusy] = useState(false)
      const [channelStatus, setChannelStatus] = useState('')
      const [fetchedModels, setFetchedModels] = useState(null)
      const [customOpen, setCustomOpen] = useState(false)
      const [customBusy, setCustomBusy] = useState(false)
      const [customStatus, setCustomStatus] = useState('')
      const [custom, setCustom] = useState({ route: '', displayName: '', baseURL: '', protocol: 'openai-completions', apiKey: '', model: '', contextWindow: '', maxTokens: '', efforts: '' })
      const [piProvider, setPiProvider] = useState('magpie')
      const [piModel, setPiModel] = useState('')
      const [piEffort, setPiEffort] = useState('')
      const [piStatus, setPiStatus] = useState('')
      const [modelStatus, setModelStatus] = useState('')
      const [modelSaving, setModelSaving] = useState(false)
      const [modelContext, setModelContext] = useState('')
      const [modelMaxTokens, setModelMaxTokens] = useState('')
      const [modelEffort, setModelEffort] = useState('')

      const providerGroups = catalog.groups || []
      const mainProvider = catalog.default?.provider
      const mainModel = catalog.default?.model
      const mainLabel = mainProvider && mainModel ? routeLabel(mainProvider, mainModel, providerGroups) : '—'
      const currentLabel = currentRoute
        ? routeLabel(currentRoute.provider, currentRoute.model, providerGroups)
        : t('currentFollow')
      const currentTone = currentRoute ? 'active' : 'default'

      useEffect(() => { setSelectedRoute(savedRouteKey) }, [modelsSnap?.value, savedRouteKey])
      useEffect(() => {
        if (channelId) return
        const configured = Object.keys(providerConfigs)
        const initial = (mainProvider && providerConfigs[mainProvider] ? mainProvider : configured[0]) || savedRoutes[0]?.provider || providerGroups[0]?.id || 'magpie'
        setChannelId(initial)
      }, [channelId, providerConfigs, savedRoutes, mainProvider, providerGroups])
      useEffect(() => {
        const config = providerConfigs[channelId]
        setChannelBaseURL(config?.baseURL || '')
        setChannelApiKey('')
        setFetchedModels(null)
        setChannelStatus('')
      }, [channelId, llmSnap?.value])
      useEffect(() => {
        const value = piSnap?.value
        if (!value) return
        const parsed = parseEffort(value.model || '')
        setPiProvider(value.provider || 'magpie')
        setPiModel(parsed.model)
        setPiEffort(parsed.effort)
      }, [piSnap?.value])

      const selectedRouteValue = selectedRoute ? parseRoute(selectedRoute) : undefined
      const selectedProviderConfig = selectedRouteValue ? providerConfigs[selectedRouteValue.provider] : undefined
      const selectedCatalogModel = selectedRouteValue ? (providerGroups.find(group => group.id === selectedRouteValue.provider)?.models.find(model => model.id === selectedRouteValue.model)
        || providerGroups.flatMap(group => group.models || []).find(model => model.id === selectedRouteValue.model)) : undefined
      const effortLevels = useMemo(() => {
        const configured = Object.values(providerConfigs).flatMap(config => config?.models || []).filter(model => model.id === selectedRouteValue?.model)
        const fromConfig = configured.flatMap(model => model.reasoningEfforts && typeof model.reasoningEfforts === 'object' ? Object.keys(model.reasoningEfforts) : [])
        const fromCatalog = selectedCatalogModel?.reasoning?.efforts?.map(level => typeof level === 'string' ? level : level.id) || []
        return EFFORT_LEVELS.filter(level => fromConfig.includes(level) || fromCatalog.includes(level))
      }, [selectedCatalogModel, providerConfigs, selectedRoute])
      const catalogEffort = selectedCatalogModel?.reasoning?.defaultEffort
      const savedEffort = piSnap?.value?.nativeReasoningEffort
      const initialModelEffort = effortLevels.includes(savedEffort) ? savedEffort : effortLevels.includes(catalogEffort) ? catalogEffort : ''
      const effortChoices = useMemo(() => effortLevels.length && !effortLevels.includes(catalogEffort) ? ['', ...effortLevels] : effortLevels, [effortLevels, catalogEffort])
      const currentModelEffort = effortChoices.includes(modelEffort) ? modelEffort : initialModelEffort
      const channelGroup = providerGroups.find(group => group.id === channelId)
      const providerOptions = useMemo(() => {
        const options = [...providerGroups]
        for (const id of Object.keys(providerConfigs)) {
          if (!options.some(group => group.id === id)) options.push({ id, name: providerConfigs[id]?.displayName || id })
        }
        if (channelId && !options.some(group => group.id === channelId)) options.unshift({ id: channelId, name: channelId })
        return options
      }, [channelId, providerConfigs, providerGroups])
      const channelModels = useMemo(() => fetchedModels ?? channelGroup?.models ?? [], [fetchedModels, channelGroup?.models])
      const channelIsOfficial = channelId === 'deepseek-account'
      const channelConfig = providerConfigs[channelId]
      const modelOptions = useMemo(() => {
        const options = channelModels.map(model => {
          const resolvedProvider = resolveModelProvider(model.id, channelId)
          return { key: keyOf(resolvedProvider, model.id), label: model.name || model.id, detail: `${resolvedProvider}/${model.id}` }
        })
        if (selectedRoute && !options.some(option => option.key === selectedRoute)) {
          const route = parseRoute(selectedRoute)
          options.unshift({ key: selectedRoute, label: routeLabel(route.provider, route.model, providerGroups), detail: `${route.provider}/${route.model}` })
        }
        return options
      }, [channelId, channelModels, providerConfigs, providerGroups, selectedRoute])

      useEffect(() => {
        const model = selectedRouteValue && (selectedProviderConfig?.models?.find(item => item.id === selectedRouteValue.model) || channelModels.find(item => item.id === selectedRouteValue.model))
        setModelContext(model?.contextWindow ? String(model.contextWindow) : '')
        setModelMaxTokens(model?.maxTokens ? String(model.maxTokens) : '')
        setModelEffort(initialModelEffort)
      }, [selectedRoute, llmSnap?.value, channelModels, effortLevels, initialModelEffort, selectedCatalogModel])

      const setCustomField = useCallback((key, value) => setCustom(current => ({ ...current, [key]: value })), [])
      const toggleCustomEffort = useCallback((level) => setCustom(current => {
        const values = current.efforts.split(',').map(value => value.trim()).filter(Boolean)
        const next = values.includes(level) ? values.filter(value => value !== level) : [...values, level]
        return { ...current, efforts: next.join(',') }
      }), [])

      const fetchChannelModels = useCallback(async () => {
        if (!channelId || channelIsOfficial) {
          setChannelStatus(channelIsOfficial ? t('officialChannel') : '')
          return
        }
        setChannelBusy(true)
        setChannelStatus('')
        try {
          const request = { provider: channelId }
          if (channelBaseURL.trim()) request.baseURL = channelBaseURL.trim()
          if (channelConfig?.api) request.api = channelConfig.api
          if (channelApiKey.trim()) request.apiKey = channelApiKey.trim()
          const response = await controller.remote.llm.discoverModels('llm-pi-ai', request)
          if (!response.ok) throw new Error(response.error?.message || 'model discovery failed')
          setFetchedModels((response.value || []).map(model => ({
            id: model.id, name: model.name || model.id,
            contextWindow: model.contextWindow, maxTokens: model.maxTokens,
          })))
          setChannelStatus(t('modelsFetched'))
        } catch (error) {
          setChannelStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setChannelBusy(false)
        }
      }, [channelApiKey, channelBaseURL, channelConfig, channelId, channelIsOfficial, controller, t])

      const saveChannel = useCallback(async () => {
        if (channelIsOfficial) return
        if (!channelConfig) {
          setChannelStatus(`${t('failed')}${t('unavailable')}`)
          return
        }
        setChannelBusy(true)
        setChannelStatus('')
        try {
          const next = { ...channelConfig }
          if (channelBaseURL.trim()) next.baseURL = channelBaseURL.trim()
          const key = channelApiKey.trim()
          if (key) {
            const ref = channelConfig.apiKeyEnv || `${channelId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
            const stored = await controller.remote.credentials.set(ref, key)
            if (!stored.ok) throw new Error(stored.error?.message || 'credential store failed')
            next.apiKeyEnv = ref
          }
          const ok = await controller.llmForm.mutate([{ op: 'set', path: ['providers', channelId], value: next }])
          if (!ok) throw new Error('settings write refused')
          setChannelApiKey('')
          await catalog.reload()
          setChannelStatus(t('channelSaved'))
        } catch (error) {
          setChannelStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setChannelBusy(false)
        }
      }, [catalog, channelApiKey, channelBaseURL, channelConfig, channelId, channelIsOfficial, controller, t])

      const fetchCustomModels = useCallback(async () => {
        setCustomBusy(true); setCustomStatus('')
        try {
          const request = { baseURL: custom.baseURL.trim(), api: custom.protocol }
          if (custom.apiKey.trim()) request.apiKey = custom.apiKey.trim()
          const response = await controller.remote.llm.discoverModels('llm-pi-ai', request)
          if (!response.ok) throw new Error(response.error?.message || 'model discovery failed')
          const models = (response.value || []).map(model => ({
            id: model.id, name: model.name || model.id,
            contextWindow: model.contextWindow, maxTokens: model.maxTokens,
          }))
          const first = models[0]
          setCustom(current => ({
            ...current, models,
            model: first?.id || '',
            contextWindow: first?.contextWindow ? String(first.contextWindow) : '',
            maxTokens: first?.maxTokens ? String(first.maxTokens) : '',
          }))
          if (models.length === 0) setCustomStatus(t('modelsEmpty'))
        } catch (error) {
          setCustomStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        } finally { setCustomBusy(false) }
      }, [controller, custom.apiKey, custom.baseURL, custom.protocol, t])

      const saveCustomChannel = useCallback(async () => {
        setCustomBusy(true); setCustomStatus('')
        try {
          const route = custom.route.trim()
          if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(route)) throw new Error(t('routeInvalid'))
          if (providerConfigs[route]) throw new Error(t('channelExists'))
          if (!custom.baseURL.trim() || !custom.model) throw new Error(t('modelsEmpty'))
          const ref = `${route.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
          if (custom.apiKey.trim()) {
            const stored = await controller.remote.credentials.set(ref, custom.apiKey.trim())
            if (!stored.ok) throw new Error(stored.error?.message || 'credential store failed')
          }
          const selected = custom.models?.find(model => model.id === custom.model)
          const efforts = custom.efforts.split(',').map(value => value.trim()).filter(Boolean)
          const profile = {
            displayName: custom.displayName.trim() || route,
            api: custom.protocol,
            baseURL: custom.baseURL.trim(),
            ...(custom.apiKey.trim() ? { apiKeyEnv: ref } : {}),
            models: [{
              id: custom.model,
              name: selected?.name || custom.model,
              ...(custom.contextWindow ? { contextWindow: Number(custom.contextWindow) } : {}),
              ...(custom.maxTokens ? { maxTokens: Number(custom.maxTokens) } : {}),
              ...(efforts.length > 0 ? { reasoningEfforts: Object.fromEntries(efforts.map(level => [level, level])) } : {}),
            }],
          }
          const ok = await controller.llmForm.mutate([{ op: 'set', path: ['providers', route], value: profile }])
          if (!ok) throw new Error('settings write refused')
          setCustomStatus(t('customSaved'))
          setCustomOpen(false)
          setChannelId(route)
          setCustom({ route: '', displayName: '', baseURL: '', protocol: 'openai-completions', apiKey: '', model: '', contextWindow: '', maxTokens: '', efforts: '' })
          await catalog.reload()
        } catch (error) {
          setCustomStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        } finally { setCustomBusy(false) }
      }, [catalog, controller, custom, providerConfigs, t])

      const saveModel = useCallback(async () => {
        if (modelSaving) return
        const snapshot = formSnapshot(controller.modelsForm)
        const blocked = !snapshot || snapshot.status === 'unavailable' ? 'unavailable'
          : snapshot.status !== 'ready' ? 'formLoading' : !snapshot.writable ? 'readOnly' : ''
        if (blocked) { setModelStatus(`${t('failed')}${t(blocked)}`); return }
        setModelSaving(true)
        setModelStatus('')
        const allowedModels = selectedRoute ? [parseRoute(selectedRoute)] : []
        try {
          // Persist the selected model's context/effort on its provider first.
          if (selectedRouteValue && selectedProviderConfig) {
            const models = [...(selectedProviderConfig.models || [])]
            const index = models.findIndex(item => item.id === selectedRouteValue.model)
            const discovered = channelModels.find(item => item.id === selectedRouteValue.model)
            const entry = { ...(index >= 0 ? models[index] : { id: selectedRouteValue.model, name: discovered?.name || selectedRouteValue.model, ...(discovered?.contextWindow ? { contextWindow: discovered.contextWindow } : {}), ...(discovered?.maxTokens ? { maxTokens: discovered.maxTokens } : {}) }) }
            if (modelContext.trim() && Number.isFinite(Number(modelContext))) entry.contextWindow = Number(modelContext)
            else delete entry.contextWindow
            if (modelMaxTokens.trim() && Number.isFinite(Number(modelMaxTokens))) entry.maxTokens = Number(modelMaxTokens)
            else delete entry.maxTokens
            if (index >= 0) models[index] = entry
            else models.push(entry)
            const detailOk = await controller.llmForm.mutate([{ op: 'set', path: ['providers', selectedRouteValue.provider], value: { ...selectedProviderConfig, models } }])
            if (!detailOk) throw new Error('model detail write refused')
          }
          if (selectedRouteValue && controller.piForm) {
            const effortOk = await controller.piForm.mutate([{ op: 'set', path: ['nativeReasoningEffort'], value: currentModelEffort }])
            if (!effortOk) throw new Error('effort write refused')
          }
          // ConfigForm.mutate reduces every Host refusal to false, losing its cause.
          const response = await controller.remote.settings.mutate('subagent-model-selection-settings', [
            { op: 'set', path: ['enabled'], value: allowedModels.length > 0 },
            { op: 'set', path: ['allowedModels'], value: allowedModels },
          ], snapshot.revision)
          if (!response.ok) {
            const latest = await controller.remote.settings.describe().catch(() => undefined)
            const view = latest?.ok && latest.value.namespaces.find(row => row.ns === 'subagent-model-selection-settings')
            if (view) controller.settings.acceptView(view)
            throw new Error(response.error?.message || t('writeRefused'))
          }
          controller.settings.acceptView(response.value)
          setModelStatus(t('saved'))
        } catch (error) {
          setModelStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setModelSaving(false)
        }
      }, [channelModels, controller, modelContext, currentModelEffort, modelMaxTokens, modelSaving, selectedProviderConfig, selectedRoute, selectedRouteValue, t])

      const savePi = useCallback(async () => {
        if (!controller.piForm) { setPiStatus(`${t('failed')}${t('unavailable')}`); return }
        setPiStatus('')
        const model = piModel ? `${piModel}${piEffort ? `:${piEffort}` : ''}` : ''
        try {
          const ok = await controller.piForm.mutate([
            { op: 'set', path: ['provider'], value: piProvider },
            { op: 'set', path: ['model'], value: model },
          ])
          setPiStatus(ok ? t('saved') : `${t('failed')}${t('unavailable')}`)
        } catch (error) {
          setPiStatus(`${t('failed')}${error instanceof Error ? error.message : String(error)}`)
        }
      }, [controller, piEffort, piModel, piProvider, t])

      const selectModel = useCallback((key) => { setSelectedRoute(key); setModelStatus('') }, [])

      return h('div', { style: { padding: '2px 0 28px', maxWidth: 1080 } },
        h('div', { style: { paddingBottom: 18 } },
          h('h2', { style: { margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em' } }, t('title')),
          h('p', { style: { margin: '7px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--dsw-alias-text-secondary, #666)', maxWidth: '68ch' } }, t('intro')),
        ),
        h('div', {
          style: {
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px 32px',
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--dsw-alias-bg-l1, rgba(127,127,127,.06))',
          },
        },
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '16px 40px', minWidth: 0 } },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } },
              h('span', { style: { fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: 'var(--dsw-alias-text-secondary, #666)' } }, t('currentLabel')),
              h('strong', { style: { fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, currentLabel),
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } },
              h('span', { style: { fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: 'var(--dsw-alias-text-secondary, #666)' } }, t('mainModel')),
              h('strong', { style: { fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, mainLabel),
            ),
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 } },
            h(StatusPill, { tone: currentTone }, currentRoute ? t('currentFixed') : legacyCount > 0 ? t('currentMixed') : t('defaultBadge')),
            legacyCount > 0 ? h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)', textAlign: 'right' } }, t('currentMixedHint')) : null,
          ),
        ),

        h(SectionRow, { title: t('channelTitle'), description: t('channelDescription') },
          h(Field, { label: t('channel'), flex: '1 1 320px' },
            h('select', {
              value: channelId,
              onChange: event => setChannelId(event.target.value),
              style: { height: 38, borderRadius: 8, padding: '0 10px', border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' },
            }, [h('option', { key: '__choose', value: '' }, t('chooseChannel')), ...providerOptions.map(group => h('option', { key: group.id, value: group.id }, group.name || group.id))]),
          ),
          channelIsOfficial
            ? h('p', { style: { margin: '14px 0 0', fontSize: 13, color: 'var(--dsw-alias-text-secondary, #666)' } }, t('officialChannel'))
            : !channelId ? h('p', { style: { margin: '14px 0 0', fontSize: 13, color: 'var(--dsw-alias-text-secondary, #666)' } }, t('chooseChannel')) : h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, alignItems: 'flex-end' } },
              h(Field, { label: t('baseUrl'), flex: '1 1 300px' },
                h('input', { value: channelBaseURL, onChange: e => setChannelBaseURL(e.target.value), placeholder: 'https://api.example.com/v1', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } }),
              ),
              h(Field, { label: t('apiKey'), flex: '1 1 220px' },
                h('input', { type: 'password', value: channelApiKey, onChange: e => setChannelApiKey(e.target.value), placeholder: t('apiKeyStored'), style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } }),
              ),
            ),
          !channelIsOfficial && channelId ? h('div', { style: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' } },
            h(Button, { onClick: fetchChannelModels, disabled: channelBusy }, channelBusy ? t('fetching') : t('fetchModels')),
            h(Button, { onClick: saveChannel, disabled: channelBusy }, t('saveChannel')),
          ) : null,
          channelStatus ? h('p', { role: 'status', style: { margin: '10px 0 0', fontSize: 12, color: channelStatus === t('modelsFetched') || channelStatus === t('channelSaved') ? 'var(--dsw-alias-text-positive, #177245)' : 'var(--dsw-alias-text-negative, #b42318)' } }, channelStatus) : null,
          h('div', { style: { marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18))' } },
            h('button', {
              type: 'button', onClick: () => setCustomOpen(open => !open),
              style: { border: 0, padding: 0, background: 'transparent', color: 'var(--dsw-alias-text-accent, #4f46e5)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
            }, `${customOpen ? '− ' : '+ '}${t('customChannel')}`),
            customOpen ? h('div', { style: { marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' } },
              h('p', { style: { flexBasis: '100%', margin: 0, fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)', lineHeight: 1.5 } }, t('customChannelHint')),
              h(Field, { label: t('routeId'), flex: '0 1 150px' }, h('input', { value: custom.route, onChange: e => setCustomField('route', e.target.value), placeholder: 'acme-gateway', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Field, { label: t('displayName'), flex: '0 1 170px' }, h('input', { value: custom.displayName, onChange: e => setCustomField('displayName', e.target.value), placeholder: 'Acme Gateway', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Field, { label: t('baseUrl'), flex: '1 1 260px' }, h('input', { value: custom.baseURL, onChange: e => setCustomField('baseURL', e.target.value), placeholder: 'https://api.example.com/v1', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Field, { label: t('protocol'), flex: '0 1 180px' }, h('select', { value: custom.protocol, onChange: e => setCustomField('protocol', e.target.value), style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } }, h('option', { value: 'openai-completions' }, 'openai-completions'), h('option', { value: 'openai-responses' }, 'openai-responses'))),
              h(Field, { label: t('apiKey'), flex: '0 1 200px' }, h('input', { type: 'password', value: custom.apiKey, onChange: e => setCustomField('apiKey', e.target.value), style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Button, { onClick: fetchCustomModels, disabled: customBusy }, customBusy ? t('fetching') : t('fetchModels')),
              custom.models?.length ? h(Field, { label: t('modelTitle'), flex: '0 1 240px' }, h('select', { value: custom.model, onChange: e => { const model = custom.models.find(item => item.id === e.target.value); setCustom(current => ({ ...current, model: e.target.value, contextWindow: model?.contextWindow ? String(model.contextWindow) : '', maxTokens: model?.maxTokens ? String(model.maxTokens) : '' })) }, style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } }, custom.models.map(model => h('option', { key: model.id, value: model.id }, `${model.name} (${model.id})`)))) : null,
              custom.models?.length ? h(Field, { label: t('contextWindow'), flex: '0 1 120px' }, h('input', { value: custom.contextWindow, onChange: e => setCustomField('contextWindow', e.target.value), inputMode: 'numeric', placeholder: '200000', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })) : null,
              custom.models?.length ? h(Field, { label: t('maxTokens'), flex: '0 1 120px' }, h('input', { value: custom.maxTokens, onChange: e => setCustomField('maxTokens', e.target.value), inputMode: 'numeric', placeholder: '8192', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })) : null,
              custom.models?.length ? h(Field, { label: t('efforts'), flex: '1 1 260px' },
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 38, alignItems: 'center' } },
                  EFFORT_LEVELS.map(level => h('label', { key: level, style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.25))', fontSize: 12, cursor: 'pointer' } },
                    h('input', { type: 'checkbox', checked: custom.efforts.split(',').map(value => value.trim()).includes(level), onChange: () => toggleCustomEffort(level) }),
                    level,
                  )),
                ),
              ) : null,
              custom.models?.length ? h(Button, { onClick: saveCustomChannel, disabled: customBusy }, t('saveChannel')) : null,
            ) : null,
            customStatus ? h('p', { role: 'status', style: { margin: '10px 0 0', fontSize: 12, color: customStatus === t('customSaved') ? 'var(--dsw-alias-text-positive, #177245)' : 'var(--dsw-alias-text-negative, #b42318)' } }, customStatus) : null,
          ),
        ),

        h(SectionRow, { title: t('modelTitle'), description: t('modelDescription') },
          h('div', { role: 'radiogroup', 'aria-label': t('modelTitle'), style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h('label', {
              style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: selectedRoute === '' ? 'var(--dsw-alias-bg-l2, rgba(127,127,127,.1))' : 'transparent' },
            },
              h('input', { type: 'radio', name: 'subagent-model', checked: selectedRoute === '', onChange: () => selectModel('') }),
              h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                h('span', { style: { fontSize: 14, fontWeight: 500 } }, t('followMain')),
                h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)' } }, `${t('followMainHint')} · ${mainLabel}`),
              ),
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 286, overflowY: 'auto', paddingRight: 2 } },
              modelOptions.map(option => h('label', {
                key: option.key,
                style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: selectedRoute === option.key ? 'var(--dsw-alias-bg-l2, rgba(127,127,127,.1))' : 'transparent' },
              },
                h('input', { type: 'radio', name: 'subagent-model', checked: selectedRoute === option.key, onChange: () => selectModel(option.key) }),
                h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                  h('span', { style: { fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, option.label),
                  h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, option.detail),
                ),
              )),
            ),
            modelOptions.length === 0 ? h('p', { style: { margin: '10px 0', fontSize: 13, color: 'var(--dsw-alias-text-secondary, #666)' } }, catalog.status === 'loading' ? t('loading') : t('modelsEmpty')) : null,
            selectedRouteValue && (selectedProviderConfig || effortLevels.length > 0) ? h('div', { style: { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.16))' } },
              h('p', { style: { margin: '0 0 10px', fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)' } }, t('modelSettingsHint')),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' } },
                h(Field, { label: t('contextWindow'), flex: '0 1 130px' }, h('input', { value: modelContext, onChange: e => setModelContext(e.target.value), inputMode: 'numeric', placeholder: '200000', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
                h(Field, { label: t('maxTokens'), flex: '0 1 130px' }, h('input', { value: modelMaxTokens, onChange: e => setModelMaxTokens(e.target.value), inputMode: 'numeric', placeholder: '8192', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
                h(Field, { label: t('effort'), flex: '1 1 240px' },
                  effortChoices.length > 1 ? h('div', null,
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 } },
                      h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)' } }, currentModelEffort || t('effortDefaultShort')),
                    ),
                    h('input', {
                      type: 'range', min: 0, max: effortChoices.length - 1, step: 1, 'aria-label': t('effort'),
                      'aria-valuetext': currentModelEffort || t('effortDefaultShort'),
                      value: effortChoices.indexOf(currentModelEffort),
                      onChange: e => setModelEffort(effortChoices[Number(e.target.value)]),
                      style: { width: '100%', padding: 0, margin: '8px 0 2px', accentColor: 'var(--dsw-alias-text-accent, #4f46e5)' },
                    }),
                    h('div', { style: { position: 'relative', height: 14, margin: '0 8px' } },
                      effortChoices.map((level, index) => h('span', { key: level || '__default', style: { position: 'absolute', left: `${index / (effortChoices.length - 1) * 100}%`, transform: 'translateX(-50%)', fontSize: 10, color: 'var(--dsw-alias-text-secondary, #777)' } }, level || t('effortDefaultShort'))),
                    ),
                  ) : h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)' } }, t('effortUnsupported')),
                ),
              ),
            ) : selectedRouteValue ? h('p', { style: { margin: '14px 0 0', fontSize: 12, color: 'var(--dsw-alias-text-secondary, #666)' } }, t('modelSettingsUnavailable')) : null,
          ),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 16, alignItems: 'center', gap: 12 } },
            modelStatus ? h('span', { role: 'status', style: { fontSize: 12, color: modelStatus === t('saved') ? 'var(--dsw-alias-text-positive, #177245)' : 'var(--dsw-alias-text-negative, #b42318)' } }, modelStatus) : null,
            h(Button, { primary: true, onClick: saveModel, disabled: modelSaving }, t('saveModel')),
          ),
        ),

        h(SectionRow, { title: t('piTitle'), description: t('piDescription') },
          h('details', { style: { borderTop: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.18))', paddingTop: 14 } },
            h('summary', { style: { cursor: 'pointer', fontSize: 13, fontWeight: 600 } }, t('piToggle')),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginTop: 14 } },
              h(Field, { label: t('piProvider'), flex: '1 1 160px' }, h('input', { value: piProvider, onChange: e => setPiProvider(e.target.value), placeholder: 'magpie', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Field, { label: t('piModel'), flex: '2 1 280px' }, h('input', { value: piModel, onChange: e => setPiModel(e.target.value), placeholder: 'workbuddy/deepseek-v4.1-flash', style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } })),
              h(Field, { label: t('piEffort'), flex: '0 1 130px' }, h('select', { value: piEffort, onChange: e => setPiEffort(e.target.value), style: { height: 38, borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))', padding: '0 10px', background: 'var(--dsw-alias-bg-base, #fff)', color: 'inherit', font: 'inherit' } }, h('option', { value: '' }, t('piDefault')), ['low', 'medium', 'high', 'xhigh', 'max'].map(level => h('option', { key: level, value: level }, level)))),
              h(Button, { onClick: savePi }, t('savePi')),
            ),
            piStatus ? h('p', { role: 'status', style: { margin: '10px 0 0', fontSize: 12, color: piStatus === t('saved') ? 'var(--dsw-alias-text-positive, #177245)' : 'var(--dsw-alias-text-negative, #b42318)' } }, piStatus) : null,
          ),
        ),
      )
    }

    function createController(ctx) {
      return {
        remote: ctx.remote,
        settings: ctx.configForms.describe(),
        modelsForm: ctx.configForms.get('subagent-model-selection-settings'),
        piForm: ctx.configForms.get('subagent-pi'),
        llmForm: ctx.configForms.get('llm-pi-ai'),
      }
    }

    return {
      inject: ['slots', 'locale', 'configForms', 'remote', 'remote.session', 'remote.settings', 'remote.llm', 'remote.credentials'],
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'subagent-toolkit: dictionaries')
        const controller = createController(ctx)
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'subagent-toolkit',
          order: 30,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({ t, controller }),
        }, SubagentPage)), 'subagent-toolkit: settings page')
      },
    }
  },
})
