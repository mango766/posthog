import type { z } from 'zod'

import { withUiApp } from '@/resources/ui-apps'
import { SurveyGlobalStatsSchema } from '@/schema/tool-inputs'
import { withPostHogUrl, type WithPostHogUrl } from '@/tools/tool-utils'
import type { Context, ToolBase } from '@/tools/types'

const schema = SurveyGlobalStatsSchema
type Params = z.infer<typeof schema>
type Result = WithPostHogUrl

export const globalStatsHandler: ToolBase<typeof schema, Result>['handler'] = async (
    context: Context,
    params: Params
) => {
    const projectId = await context.stateManager.getProjectId()

    const result = await context.api.surveys({ projectId }).globalStats({ params })

    if (!result.success) {
        throw new Error(`Failed to get survey global stats: ${result.error.message}`)
    }

    return withPostHogUrl(result.data, `${context.api.getProjectBaseUrl(projectId)}/surveys`)
}

export default (): ToolBase<typeof schema, Result> =>
    withUiApp('survey-global-stats', {
        name: 'surveys-global-stats',
        schema,
        handler: globalStatsHandler,
    })
