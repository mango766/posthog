import type { z } from 'zod'

import { withUiApp } from '@/resources/ui-apps'
import { SurveyGetAllSchema } from '@/schema/tool-inputs'
import { formatSurveys, type FormattedSurvey } from '@/tools/surveys/utils/survey-utils'
import { withPostHogUrl } from '@/tools/tool-utils'
import type { Context, ToolBase } from '@/tools/types'

const schema = SurveyGetAllSchema
type Params = z.infer<typeof schema>

type Result = { results: FormattedSurvey[] }

export const getAllHandler: ToolBase<typeof schema, Result>['handler'] = async (context: Context, params: Params) => {
    const projectId = await context.stateManager.getProjectId()

    const surveysResult = await context.api.surveys({ projectId }).list(params ? { params } : {})

    if (!surveysResult.success) {
        throw new Error(`Failed to get surveys: ${surveysResult.error.message}`)
    }

    const formattedSurveys = formatSurveys(surveysResult.data, context, projectId)

    return withPostHogUrl({ results: formattedSurveys }, `${context.api.getProjectBaseUrl(projectId)}/surveys`)
}

export default (): ToolBase<typeof schema, Result> =>
    withUiApp('survey-list', {
        name: 'surveys-get-all',
        schema,
        handler: getAllHandler,
    })
