/**
 * The 插件检测 settings section: scope picker + layer toggles + run button,
 * live findings list with severity badges and per-finding actions (repair /
 * rollback / copy prompt), and the run history. All writes confirm first —
 * the panel shows a two-step confirm before sending any mutation.
 * @module dsh-plugin-healthcheck/client/HealthcheckSection
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CheckFinding, HistoryRecord } from '../core/types.ts'
import { HealthcheckApi, type Inventory, type RunStatus } from './api.ts'
import type { HealthcheckKey } from './locales.ts'
import css from './healthcheck.module.css'

/** Props the section binds: locale reader + the shell's close affordance. */
export interface HealthcheckSectionProps {
  /** Locale reader for this section's copy. */
  t: (key: HealthcheckKey) => string
  /** Close the settings panel (shell-owned). */
  close: () => void
}

const SEVERITY_CLASS: Record<string, string> = {
  error: css.badgeError,
  warn: css.badgeWarn,
  info: css.badgeInfo,
}

const LAYERS = ['l0', 'l1', 'l2', 'malware'] as const

/**
 * Render the healthcheck section.
 * @param props - locale copy and the close affordance.
 */
export function HealthcheckSection(props: HealthcheckSectionProps): ReactNode {
  const { t } = props
  const apiRef = useRef<HealthcheckApi | null>(null)
  if (apiRef.current === null) apiRef.current = new HealthcheckApi()
  const api = apiRef.current

  const [inventory, setInventory] = useState<Inventory>({ profile: [], builtin: [], counts: { profile: 0, builtin: 0, total: 0 } })
  const [scopePlugin, setScopePlugin] = useState('')
  const [layers, setLayers] = useState<Record<string, boolean>>({ l0: true, l1: true, l2: true, malware: true })
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState('')
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState<{ kind: 'repair' | 'rollback'; payload: unknown } | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void api.inventory().then((envelope) => {
      if (envelope.ok) setInventory(envelope.value)
    })
    void api.history().then((envelope) => {
      if (envelope.ok) setHistory(envelope.value)
    })
    return () => {
      if (pollTimer.current !== null) clearInterval(pollTimer.current)
    }
  }, [api])

  const stopPolling = useCallback((): void => {
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const start = useCallback((): void => {
    if (running) return
    setRunning(true)
    setNotice('')
    setStatus({ stage: 'l0', finished: false, findings: [] })
    const requested = LAYERS.filter((layer) => layers[layer])
    if (requested.length === 0) {
      setRunning(false)
      setNotice(t('layerL0'))
      return
    }
    void api.run({ plugin: scopePlugin === '' ? undefined : scopePlugin, layers: requested }).then((envelope) => {
      if (!envelope.ok) {
        setRunning(false)
        setNotice(`${t('applyFailed')}: ${envelope.error.message}`)
        return
      }
      setRunId(envelope.value.runId)
      pollTimer.current = setInterval(() => {
        void api.status(envelope.value.runId).then((snapshot) => {
          if (!snapshot.ok) {
            stopPolling()
            setRunning(false)
            setNotice(`${t('applyFailed')}: ${snapshot.error.message}`)
            return
          }
          setStatus(snapshot.value)
          if (snapshot.value.finished) {
            stopPolling()
            setRunning(false)
            void api.history().then((h) => { if (h.ok) setHistory(h.value) })
          }
        })
      }, 800)
    })
  }, [running, layers, scopePlugin, api, t, stopPolling])

  const toggleLayer = (layer: string): void => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }

  const flash = (text: string): void => {
    setNotice(text)
    setTimeout(() => setNotice(''), 6000)
  }

  const requestRepair = (finding: CheckFinding): void => {
    setConfirming({ kind: 'repair', payload: finding })
  }

  const requestRollback = (finding: CheckFinding): void => {
    setConfirming({ kind: 'rollback', payload: finding })
  }

  const confirmAndApply = (): void => {
    if (confirming === null) return
    if (confirming.kind === 'repair') {
      const finding = confirming.payload as CheckFinding
      setConfirming(null)
      if (finding.repair === undefined) return
      void api.repair(finding.repair, true).then((envelope) => {
        flash(envelope.ok ? `${t('applySuccess')}: ${envelope.value.message}` : `${t('applyFailed')}: ${envelope.error.message}`)
      })
    } else {
      const finding = confirming.payload as CheckFinding
      setConfirming(null)
      const pluginId = finding.rollbackId ?? finding.plugin ?? ''
      if (pluginId === '') return
      void api.rollback(pluginId, true).then((envelope) => {
        flash(envelope.ok ? `${t('applySuccess')}: ${envelope.value.message}` : `${t('applyFailed')}: ${envelope.error.message}`)
      })
    }
  }

  const copyPrompt = (finding: CheckFinding): void => {
    if (finding.prompt === undefined) return
    void navigator.clipboard.writeText(finding.prompt).then(() => {
      flash(t('promptCopied'))
    }, () => {
      flash(`${t('applyFailed')}: clipboard`)
    })
  }

  const stageText = (): string => {
    if (status === null || status.finished) return t('done')
    if (status.stage === 'l0') return t('stageL0')
    if (status.stage === 'l1') return t('stageL1')
    if (status.stage === 'malware') return t('stageMalware')
    return t('stageL2')
  }

  const findings = status?.findings ?? []

  return (
    <div className={css.root}>
      <p className={css.description}>{t('description')}</p>
      <p className={css.ironRule}>{t('ironRule')}</p>
      <p className={css.ironRule}>{t('malwareIronRule')}</p>

      <div className={css.controls}>
        <select
          className={css.scope}
          value={scopePlugin}
          onChange={(event) => { setScopePlugin(event.target.value) }}
          aria-label={t('scopePlugin')}
        >
          <option value="">{t('scopeAll')} ({inventory.counts.total})</option>
          {inventory.profile.length > 0
            ? (
              <optgroup label={`${t('scopeProfile')} (${inventory.counts.profile})`}>
                {inventory.profile.map((row) => (
                  <option key={row.name} value={row.name}>
                    {row.disabled ? `[${t('disabledBadge')}] ` : ''}{row.name}
                  </option>
                ))}
              </optgroup>
            )
            : null}
          {inventory.builtin.length > 0
            ? (
              <optgroup label={`${t('scopeBuiltin')} (${inventory.counts.builtin})`}>
                {inventory.builtin.map((row) => (
                  <option key={row.name} value={row.name}>{row.name}</option>
                ))}
              </optgroup>
            )
            : null}
        </select>
        <div className={css.layers} role="group" aria-label="layers">
          {LAYERS.map((layer) => (
            <label key={layer} className={css.layerLabel}>
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={() => { toggleLayer(layer) }}
              />
              {t(`layer${layer.toUpperCase()}` as HealthcheckKey)}
            </label>
          ))}
        </div>
        <button type="button" className={css.runButton} onClick={start} disabled={running}>
          {running ? t('running') : t('start')}
        </button>
      </div>

      {running || status !== null
        ? (
          <div className={css.stageRow}>
            <span className={css.stageText}>{running ? stageText() : t('done')}</span>
            {status?.smoke !== undefined
              ? (
                <span className={status.smoke.ok ? css.smokeOk : css.smokeBad}>
                  {status.smoke.ok ? t('smokePassed') : t('smokeFailed')}
                </span>
              )
              : null}
          </div>
        )
        : null}

      {notice !== ''
        ? <p className={css.notice}>{notice}</p>
        : null}

      {confirming !== null
        ? (
          <div className={css.confirmBox} role="alertdialog">
            <p>{confirming.kind === 'repair' ? t('repairConfirm') : t('rollbackConfirm')}</p>
            <div className={css.confirmActions}>
              <button type="button" className={css.confirmYes} onClick={confirmAndApply}>{t('repair')}</button>
              <button type="button" className={css.confirmNo} onClick={() => { setConfirming(null) }}>取消</button>
            </div>
          </div>
        )
        : null}

      <h3 className={css.heading}>{t('findings')}</h3>
      {findings.length === 0
        ? <p className={css.empty}>{t('noFindings')}</p>
        : (
          <ul className={css.findings}>
            {findings.map((finding, index) => (
              <li key={`${finding.code}-${index}`} className={css.finding}>
                <div className={css.findingHead}>
                  <span className={SEVERITY_CLASS[finding.severity] ?? css.badgeInfo}>
                    {t(finding.severity)}
                  </span>
                  <span className={css.findingCode}>{finding.code}</span>
                  {finding.plugin !== undefined
                    ? <span className={css.findingPlugin}>{finding.plugin}</span>
                    : null}
                </div>
                <p className={css.findingMessage}>{finding.message}</p>
                {finding.evidence !== undefined && finding.evidence.length > 0
                  ? (
                    <details className={css.evidence}>
                      <summary>{t('evidence')}</summary>
                      <ul>
                        {finding.evidence.map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    </details>
                  )
                  : null}
                <div className={css.actions}>
                  {finding.fixKind === 'auto' && finding.repair !== undefined && finding.repair.kind !== 'none'
                    ? (
                      <button type="button" className={css.actionButton} onClick={() => { requestRepair(finding) }}>
                        {t('repair')}
                      </button>
                    )
                    : null}
                  {finding.fixKind === 'rollback'
                    ? (
                      <button type="button" className={css.actionButton} onClick={() => { requestRollback(finding) }}>
                        {t('rollback')}
                      </button>
                    )
                    : null}
                  {finding.prompt !== undefined
                    ? (
                      <button type="button" className={css.actionButton} onClick={() => { copyPrompt(finding) }}>
                        {t('copyPrompt')}
                      </button>
                    )
                    : null}
                </div>
              </li>
            ))}
          </ul>
        )}

      <h3 className={css.heading}>{t('history')}</h3>
      {history.length === 0
        ? <p className={css.empty}>{t('historyEmpty')}</p>
        : (
          <ul className={css.historyList}>
            {history.map((record) => (
              <li key={record.id} className={css.historyItem}>
                <span className={SEVERITY_CLASS[record.worst] ?? css.badgeInfo}>{t(record.worst)}</span>
                <span className={css.historyTime}>{new Date(record.at).toLocaleString()}</span>
                <span className={css.historyCounts}>{record.errors}E / {record.warnings}W</span>
                {record.summary.length > 0
                  ? <span className={css.historySummary}>{record.summary[0]}</span>
                  : null}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
