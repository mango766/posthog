import { afterMount, kea, path, selectors } from 'kea'
import { loaders } from 'kea-loaders'

import api from 'lib/api'
import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'

import type { recentlySpikingLogicType } from './recentlySpikingLogicType'

export const recentlySpikingLogic = kea<recentlySpikingLogicType>([
    path(['products', 'error_tracking', 'logics', 'recentlySpikingLogic']),

    loaders({
        recentSpikes: [
            [] as ErrorTrackingSpikeEvent[],
            {
                loadRecentSpikes: async () => {
                    const response = await api.errorTracking.getSpikeEvents()
                    return response.results
                },
            },
        ],
    }),

    selectors({
        recentlySpikingIssueIds: [
            (s) => [s.recentSpikes],
            (recentSpikes: ErrorTrackingSpikeEvent[]): Set<string> => {
                return new Set(recentSpikes.map((spike) => spike.issue_id))
            },
        ],
    }),

    afterMount(({ actions }) => {
        actions.loadRecentSpikes()
    }),
])
