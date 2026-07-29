import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { colors } from '../theme'

export type ViewState = 'loading' | 'empty' | 'error' | 'populated'

interface StatusStateProps {
  state: ViewState
  loadingLabel?: string
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyBody?: string
  errorMessage?: string
  onRetry?: () => void
  children: ReactNode
}

/** Same loading/empty/error/populated contract as web/src/components/StatusState.tsx, in native primitives. */
export default function StatusState({
  state,
  loadingLabel = 'Loading...',
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = 'Nothing here yet',
  emptyBody = '',
  errorMessage,
  onRetry,
  children
}: StatusStateProps) {
  if (state === 'loading') {
    return (
      <View className="items-center justify-center gap-3 py-16">
        <ActivityIndicator color={colors.vermilion} size="large" />
        <Text className="text-sm text-ink/60" accessibilityLiveRegion="polite">
          {loadingLabel}
        </Text>
      </View>
    )
  }

  if (state === 'empty') {
    return (
      <View className="items-center justify-center gap-3 py-16">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-ink/5">
          <EmptyIcon size={22} color={colors.ink} />
        </View>
        <Text className="text-center text-base font-medium text-ink">{emptyTitle}</Text>
        {emptyBody ? <Text className="max-w-[320px] text-center text-sm leading-5 text-ink/55">{emptyBody}</Text> : null}
      </View>
    )
  }

  if (state === 'error') {
    return (
      <View className="items-center justify-center gap-3 py-16">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-vermilion/10">
          <AlertTriangle size={22} color={colors.vermilion} />
        </View>
        <Text className="max-w-[320px] text-center text-sm text-ink" accessibilityRole="alert">
          {errorMessage ?? 'Something went wrong.'}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-vermilion px-5 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-bone">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  return <>{children}</>
}
