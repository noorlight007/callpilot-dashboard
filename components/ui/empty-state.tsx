import * as React from 'react'
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface StateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  /** Render without the surrounding card (for use inside tables / existing cards). */
  bare?: boolean
}

function StateShell({ icon: Icon, title, description, actionLabel, onAction, className, bare, tone }: StateProps & { icon: LucideIcon; tone: 'brand' | 'error' }) {
  const body = (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex flex-col items-center justify-center text-center px-6 py-12 animate-fade-up', className)}>
      <div
        className={cn(
          'mb-4 flex h-14 w-14 items-center justify-center rounded-2xl',
          tone === 'brand' ? 'bg-accent text-primary' : 'bg-destructive/10 text-destructive',
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant={tone === 'error' ? 'outline' : 'default'} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  )
  if (bare) return body
  return <div className="rounded-2xl border border-dashed border-border bg-card/60">{body}</div>
}

export function EmptyState({ icon = Inbox, title = 'Nothing here yet', ...rest }: Omit<StateProps, 'title'> & { title?: string }) {
  return <StateShell {...rest} icon={icon} title={title} tone="brand" />
}

/** Friendly error UI — never pass raw API errors as `description`. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this right now. Please try again.',
  actionLabel = 'Try again',
  ...rest
}: Partial<StateProps>) {
  return <StateShell {...(rest as StateProps)} icon={AlertTriangle} title={title} description={description} actionLabel={actionLabel} tone="error" />
}

/** Skeleton rows matching a table/list layout to avoid layout jump. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
