import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let retryTimeoutId: any = null
    let retryCount = 0
    const MAX_RETRIES = 5

    const doSubscribe = () => {
      if (cancelled) return

      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            retryCount = 0
          }
        })
        .catch((err: any) => {
          const isInvalidClient =
            err?.status === 400 &&
            (err?.message?.includes?.('Invalid realtime client') ||
              err?.data?.message?.includes?.('Invalid realtime client'))

          if (isInvalidClient) {
            console.warn(
              `[useRealtime] 400 Invalid realtime client para '${collectionName}'. Reconectando...`,
            )
          } else {
            console.warn(
              `[useRealtime] Erro ao subscrever em '${collectionName}':`,
              err?.message || err,
            )
          }

          if (!cancelled && retryCount < MAX_RETRIES) {
            retryCount++
            const delay = Math.min(1000 * 2 ** (retryCount - 1), 10000)
            retryTimeoutId = setTimeout(() => {
              if (!cancelled) {
                doSubscribe()
              }
            }, delay)
          }
        })
    }

    doSubscribe()

    return () => {
      cancelled = true
      if (retryTimeoutId) clearTimeout(retryTimeoutId)
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
