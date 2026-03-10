import { useState, useEffect, useCallback, useRef } from 'react'
import { GitBranch, GitPullRequest, Plus, Check, GitCommitHorizontal, AlertTriangle, Copy, Link2 } from 'lucide-react'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  toast
} from '@slayzone/ui'
import type { Task, UpdateTaskInput } from '@slayzone/task/shared'
import type { CommitInfo, AheadBehind, StatusSummary } from '../shared/types'
import { RemoteSection } from './RemoteSection'
import {
  DEFAULT_WORKTREE_BASE_PATH_TEMPLATE,
  joinWorktreePath,
  resolveWorktreeBasePathTemplate,
  slugify
} from './utils'

interface GeneralTabContentProps {
  task: Task
  projectPath: string | null
  visible: boolean
  pollIntervalMs?: number
  onUpdateTask: (data: UpdateTaskInput) => Promise<Task>
  onSwitchTab: (tab: 'changes' | 'conflicts' | 'branches') => void
  onSwitchToPrView?: (view: 'create' | 'link') => void
}

export function GeneralTabContent({
  task,
  projectPath,
  visible,
  pollIntervalMs = 5000,
  onUpdateTask,
  onSwitchTab,
  onSwitchToPrView
}: GeneralTabContentProps) {
  const targetPath = task.worktree_path ?? projectPath
  const hasWorktree = !!task.worktree_path

  // Git status
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [worktreeBranch, setWorktreeBranch] = useState<string | null>(null)
  const [statusSummary, setStatusSummary] = useState<StatusSummary | null>(null)
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([])
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [initializing, setInitializing] = useState(false)


  // Worktree
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Remote
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [upstreamAB, setUpstreamAB] = useState<AheadBehind | null>(null)


  // Poll for git data
  const fetchGitData = useCallback(async () => {
    if (!projectPath) return
    try {
      const isRepo = await window.api.git.isGitRepo(projectPath)
      setIsGitRepo(isRepo)
      if (!isRepo) return

      const [branch, remote] = await Promise.all([
        window.api.git.getCurrentBranch(projectPath),
        window.api.git.getRemoteUrl(projectPath)
      ])
      setCurrentBranch(branch)
      setRemoteUrl(remote)

      if (targetPath) {
        const activeBranch = hasWorktree ? worktreeBranch : branch
        const [status, commits, uab] = await Promise.all([
          window.api.git.getStatusSummary(targetPath),
          window.api.git.getRecentCommits(targetPath, 40),
          activeBranch ? window.api.git.getAheadBehindUpstream(targetPath, activeBranch) : Promise.resolve(null)
        ])
        setStatusSummary(status)
        setRecentCommits(commits)
        setUpstreamAB(uab)
      }
    } catch { /* polling error */ }
  }, [projectPath, targetPath, hasWorktree, worktreeBranch])

  useEffect(() => {
    if (!visible || !projectPath) return
    fetchGitData()
    const timer = setInterval(fetchGitData, pollIntervalMs)
    return () => clearInterval(timer)
  }, [visible, projectPath, pollIntervalMs, fetchGitData])

  // Fetch worktree branch
  useEffect(() => {
    if (!task.worktree_path) { setWorktreeBranch(null); return }
    window.api.git.getCurrentBranch(task.worktree_path).then(setWorktreeBranch).catch(() => setWorktreeBranch(null))
  }, [task.worktree_path])

  // Branch popover handlers

  const handleInitGit = async () => {
    if (!projectPath) return
    setInitializing(true)
    try {
      await window.api.git.init(projectPath)
      setIsGitRepo(true)
      const branch = await window.api.git.getCurrentBranch(projectPath)
      setCurrentBranch(branch)
    } catch { /* ignore */ }
    finally { setInitializing(false) }
  }

  // Worktree handlers
  const handleAddWorktree = async () => {
    if (!projectPath) return
    setCreating(true)
    setError(null)
    try {
      const basePathTemplate = (await window.api.settings.get('worktree_base_path')) || DEFAULT_WORKTREE_BASE_PATH_TEMPLATE
      const basePath = resolveWorktreeBasePathTemplate(basePathTemplate, projectPath)
      const branch = slugify(task.title) || `task-${task.id.slice(0, 8)}`
      const worktreePath = joinWorktreePath(basePath, branch)
      await window.api.git.createWorktree(projectPath, worktreePath, branch)
      await onUpdateTask({ id: task.id, worktreePath, worktreeParentBranch: currentBranch })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }


  const handleCopyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedHash(null), 1500)
    toast('Commit hash copied to clipboard')
  }, [])


  // Early returns
  if (!projectPath) {
    return <div className="p-4 text-xs text-muted-foreground">Set a project path to use Git features</div>
  }

  if (isGitRepo === null) {
    return <div className="p-4 text-xs text-muted-foreground">Checking...</div>
  }

  if (isGitRepo === false) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Not a git repository</p>
        <Button variant="outline" size="sm" onClick={handleInitGit} disabled={initializing} className="gap-2">
          {initializing ? 'Initializing...' : 'Initialize Git'}
        </Button>
      </div>
    )
  }

  const totalChanges = statusSummary ? statusSummary.staged + statusSummary.unstaged + statusSummary.untracked : 0

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 p-4 pb-0 space-y-6">
        {/* Merge/rebase banner */}
        {task.merge_state && (
          <button
            onClick={() => onSwitchTab(task.merge_state === 'uncommitted' ? 'changes' : 'conflicts')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors text-left"
          >
            <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0" />
            <span className="text-xs font-medium text-purple-300">
              {task.merge_state === 'uncommitted' ? 'Merge — reviewing changes'
                : task.merge_state === 'rebase-conflicts' ? 'Rebase — resolving conflicts'
                : 'Merge — resolving conflicts'}
            </span>
          </button>
        )}


        {/* Branch */}
        <Section label={<>Branch <span className="text-[10px] font-mono font-normal text-muted-foreground/70 ml-1.5 normal-case px-1.5 py-0.5 rounded-full bg-muted border">{(hasWorktree ? worktreeBranch : currentBranch) || 'detached HEAD'}</span></>}>
          <div className="flex gap-2">
            {onSwitchToPrView && (
              <>
                <Button variant="outline" size="sm" onClick={() => onSwitchToPrView('create')} className="gap-2 flex-1 justify-center min-w-0">
                  <GitPullRequest className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Create PR</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onSwitchToPrView('link')} className="gap-2 flex-1 justify-center min-w-0">
                  <Link2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Link PR</span>
                </Button>
              </>
            )}
            {hasWorktree ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSwitchTab('branches')}
                className="gap-2 flex-1 justify-center min-w-0"
              >
                <GitBranch className="h-4 w-4 shrink-0" />
                <span className="truncate">View worktree</span>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleAddWorktree} disabled={creating} className="gap-2 flex-1 justify-center min-w-0">
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">{creating ? 'Creating...' : 'Branch to worktree'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Create branch "{slugify(task.title) || `task-${task.id.slice(0, 8)}`}"
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </Section>

        {/* Status */}
        <Section
          label="Status"
          right={remoteUrl && (
            <button
              onClick={() => { navigator.clipboard.writeText(remoteUrl); toast('Remote URL copied') }}
              className="flex items-center gap-1 group"
              title="Click to copy"
            >
              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                {remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
              </span>
              <Copy className="h-2.5 w-2.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        >
          <div className="flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-lg border bg-muted/30">
            {statusSummary && totalChanges > 0 ? (
              <>
                {statusSummary.staged > 0 && (
                  <StatusChip
                    label={`${statusSummary.staged} staged`}
                    className="text-green-400 bg-green-500/10"
                    onClick={() => onSwitchTab('changes')}
                  />
                )}
                {statusSummary.unstaged > 0 && (
                  <StatusChip
                    label={`${statusSummary.unstaged} modified`}
                    className="text-yellow-400 bg-yellow-500/10"
                    onClick={() => onSwitchTab('changes')}
                  />
                )}
                {statusSummary.untracked > 0 && (
                  <StatusChip
                    label={`${statusSummary.untracked} untracked`}
                    className="text-muted-foreground bg-muted"
                    onClick={() => onSwitchTab('changes')}
                  />
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No changes</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => onSwitchTab('changes')} className="h-7 px-2 text-xs text-muted-foreground">
              View diff
            </Button>
            {remoteUrl && (
              <div className="ml-auto">
                <RemoteSection
                  remoteUrl={remoteUrl}
                  upstreamAB={upstreamAB}
                  targetPath={targetPath!}
                  branch={hasWorktree ? worktreeBranch : currentBranch}
                  onSyncDone={fetchGitData}
                />
              </div>
            )}
          </div>
        </Section>

      </div>

      {/* Recent commits */}
      {recentCommits.length > 0 && (
        <div className="flex-1 min-h-[200px] flex flex-col p-4 pt-6">
          <div className="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Commits</div>
          <div className="min-h-0 overflow-y-auto space-y-0.5 px-3 py-2.5 rounded-lg border bg-muted/30">
            {recentCommits.map((commit) => (
              <div
                key={commit.hash}
                className="flex items-start gap-2 py-1 px-1.5 -mx-1.5 rounded cursor-pointer hover:bg-accent/50 group"
                onClick={() => handleCopyHash(commit.shortHash)}
                title="Click to copy hash"
              >
                <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{commit.message}</div>
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-mono">{commit.shortHash}</span> · {commit.relativeDate}
                  </div>
                </div>
                {copiedHash === commit.shortHash ? (
                  <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function Section({ label, right, children }: { label: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {right && <div className="flex-1 min-w-0 flex justify-end">{right}</div>}
      </div>
      {children}
    </div>
  )
}

function StatusChip({ label, className, onClick }: { label: string; className: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('px-2 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80', className)}
    >
      {label}
    </button>
  )
}
