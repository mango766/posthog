import { useValues } from 'kea'
import { useEffect, useMemo, useState } from 'react'

import api from 'lib/api'
import { ErrorEventType, ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { Dayjs } from 'lib/dayjs'

import { SparklineEvent } from '../components/SparklineChart/SparklineChart'
import { errorTrackingIssueSceneLogic } from '../scenes/ErrorTrackingIssueScene/errorTrackingIssueSceneLogic'

export function useSparklineEvents(): SparklineEvent<string>[] {
    const { firstSeen, lastSeen, selectedEvent, issue } = useValues(errorTrackingIssueSceneLogic)
    const [spikeEvents, setSpikeEvents] = useState<ErrorTrackingSpikeEvent[]>([])

    useEffect(() => {
        if (issue?.id) {
            api.errorTracking
                .getSpikeEvents(issue.id)
                .then((response) => setSpikeEvents(response.results))
                .catch(() => setSpikeEvents([]))
        }
    }, [issue?.id])

    return useMemo(() => {
        const events = []
        if (firstSeen) {
            events.push({
                id: 'first_seen',
                date: firstSeen.toDate(),
                color: 'var(--brand-blue)',
                payload: 'First Seen',
                radius: 6,
            })
        }
        if (selectedEvent && !isFirstOrLastEvent(firstSeen, lastSeen, selectedEvent)) {
            events.push({
                id: 'current',
                date: new Date(selectedEvent.timestamp),
                color: 'var(--brand-yellow)',
                payload: 'Current',
                radius: 6,
            })
        }
        for (const spike of spikeEvents) {
            events.push({
                id: `spike_${spike.id}`,
                date: new Date(spike.detected_at),
                color: 'var(--brand-red)',
                payload: 'Spike',
                radius: 5,
            })
        }
        if (lastSeen) {
            events.push({
                id: 'last_seen',
                date: lastSeen.toDate(),
                color: 'var(--brand-red)',
                payload: 'Last Seen',
                radius: 6,
            })
        }
        return events
    }, [firstSeen, lastSeen, selectedEvent, spikeEvents])
}

function isFirstOrLastEvent(
    firstSeen: Dayjs | null,
    lastSeen: Dayjs | null,
    selectedEvent: ErrorEventType | null
): boolean {
    if (selectedEvent && firstSeen?.isSame(selectedEvent.timestamp)) {
        return true
    }
    if (selectedEvent && lastSeen?.isSame(selectedEvent.timestamp)) {
        return true
    }
    return false
}
