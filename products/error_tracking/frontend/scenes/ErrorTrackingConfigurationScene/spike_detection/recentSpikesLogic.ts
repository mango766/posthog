import { afterMount, kea, path } from 'kea'
import { loaders } from 'kea-loaders'

import api from 'lib/api'
import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'

import type { recentSpikesLogicType } from './recentSpikesLogicType'

export const recentSpikesLogic = kea<recentSpikesLogicType>([
    path([
        'products',
        'error_tracking',
        'scenes',
        'ErrorTrackingConfigurationScene',
        'spike_detection',
        'recentSpikesLogic',
    ]),

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

    afterMount(({ actions }) => {
        actions.loadRecentSpikes()
    }),
])
