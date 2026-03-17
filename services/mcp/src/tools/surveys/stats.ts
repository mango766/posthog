import type { z } from 'zod'

import { withUiApp } from '@/resources/ui-apps'
import { SurveyStatsSchema } from '@/schema/tool-inputs'
import { withPostHogUrl, type WithPostHogUrl } from '@/tools/tool-utils'
import type { Context, ToolBase } from '@/tools/types'

const schema = SurveyStatsSchema
type Params = z.infer<typeof schema>
type Result = WithPostHogUrl

export const statsHandler: ToolBase<typeof schema, Result>['handler'] = async (context: Context, params: Params) => {
    const projectId = await context.stateManager.getProjectId()

    const result = await context.api.surveys({ projectId }).stats({
        survey_id: params.survey_id,
        date_from: params.date_from,
        date_to: params.date_to,
    })

    if (!result.success) {
        throw new Error(`Failed to get survey stats: ${result.error.message}`)
    }

    return withPostHogUrl(result.data, `${context.api.getProjectBaseUrl(projectId)}/surveys/${params.survey_id}`)
}

export default (): ToolBase<typeof schema, Result> =>
    withUiApp('survey-stats', {
        name: 'survey-stats',
        schema,
        handler: statsHandler,
    })
