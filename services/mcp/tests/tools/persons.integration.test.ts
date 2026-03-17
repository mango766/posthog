import { beforeAll, describe, expect, it } from 'vitest'

import {
    TEST_ORG_ID,
    TEST_PROJECT_ID,
    createTestClient,
    createTestContext,
    parseToolResponse,
    setActiveProjectAndOrg,
    validateEnvironmentVariables,
} from '@/shared/test-utils'
import { GENERATED_TOOLS } from '@/tools/generated/persons'
import type { Context } from '@/tools/types'

describe('Persons', { concurrent: false }, () => {
    let context: Context

    beforeAll(async () => {
        validateEnvironmentVariables()
        const client = createTestClient()
        context = createTestContext(client)
        await setActiveProjectAndOrg(context, TEST_PROJECT_ID!, TEST_ORG_ID!)
    })

    describe('persons-list tool', () => {
        const listTool = GENERATED_TOOLS['persons-list']!()

        it('should list persons with paginated results', async () => {
            const result = await listTool.handler(context, {})
            const response = parseToolResponse(result)

            expect(response.results).toBeTruthy()
            expect(Array.isArray(response.results)).toBe(true)
            expect(response._posthogUrl).toContain('/persons')
        })

        it('should support pagination with limit and offset', async () => {
            const result = await listTool.handler(context, { limit: 2, offset: 0 })
            const response = parseToolResponse(result)

            expect(Array.isArray(response.results)).toBe(true)
            expect(response.results.length).toBeLessThanOrEqual(2)
        })

        it('should support search by email', async () => {
            const result = await listTool.handler(context, { search: 'test@' })
            const response = parseToolResponse(result)

            expect(Array.isArray(response.results)).toBe(true)
        })
    })

    describe('persons-retrieve tool', () => {
        const listTool = GENERATED_TOOLS['persons-list']!()
        const retrieveTool = GENERATED_TOOLS['persons-retrieve']!()

        it('should retrieve a person by numeric ID', async () => {
            const listResult = await listTool.handler(context, { limit: 1 })
            const listResponse = parseToolResponse(listResult)

            if (listResponse.results.length === 0) {
                console.warn('No persons found in project, skipping retrieve test')
                return
            }

            const person = listResponse.results[0]
            const result = await retrieveTool.handler(context, { id: person.id })
            const retrieved = parseToolResponse(result)

            expect(retrieved.id).toBe(person.id)
            expect(retrieved.uuid).toBeTruthy()
            expect(retrieved.distinct_ids).toBeTruthy()
            expect(retrieved.properties).toBeTruthy()
            expect(retrieved._posthogUrl).toContain('/persons/')
        })
    })

    describe('persons-values-retrieve tool', () => {
        const valuesTool = GENERATED_TOOLS['persons-values-retrieve']!()

        it('should return values for a person property key', async () => {
            const result = await valuesTool.handler(context, { key: 'email' })
            const response = parseToolResponse(result)

            expect(Array.isArray(response)).toBe(true)
        })

        it('should filter values by search string', async () => {
            const result = await valuesTool.handler(context, { key: 'email', value: 'test' })
            const response = parseToolResponse(result)

            expect(Array.isArray(response)).toBe(true)
        })
    })

    describe('persons-cohorts-retrieve tool', () => {
        const listTool = GENERATED_TOOLS['persons-list']!()
        const cohortsTool = GENERATED_TOOLS['persons-cohorts-retrieve']!()

        it('should return cohorts for a person', async () => {
            const listResult = await listTool.handler(context, { limit: 1 })
            const listResponse = parseToolResponse(listResult)

            if (listResponse.results.length === 0) {
                console.warn('No persons found in project, skipping cohorts test')
                return
            }

            const person = listResponse.results[0]
            const result = await cohortsTool.handler(context, { person_id: String(person.id) })
            const response = parseToolResponse(result)

            expect(Array.isArray(response)).toBe(true)
        })
    })

    describe('persons-update-property-create tool', () => {
        const listTool = GENERATED_TOOLS['persons-list']!()
        const updatePropertyTool = GENERATED_TOOLS['persons-update-property-create']!()

        it('should set a property on a person', async () => {
            const listResult = await listTool.handler(context, { limit: 1 })
            const listResponse = parseToolResponse(listResult)

            if (listResponse.results.length === 0) {
                console.warn('No persons found in project, skipping update property test')
                return
            }

            const person = listResponse.results[0]
            const testKey = `mcp_test_prop_${Date.now()}`

            // The endpoint returns 202 Accepted — the property is updated asynchronously
            const result = await updatePropertyTool.handler(context, {
                id: person.id,
                key: testKey,
                value: 'test_value',
            })

            expect(result).toBeTruthy()
        })
    })

    describe('persons-delete-property-create tool', () => {
        const listTool = GENERATED_TOOLS['persons-list']!()
        const deletePropertyTool = GENERATED_TOOLS['persons-delete-property-create']!()

        it('should delete a property from a person', async () => {
            const listResult = await listTool.handler(context, { limit: 1 })
            const listResponse = parseToolResponse(listResult)

            if (listResponse.results.length === 0) {
                console.warn('No persons found in project, skipping delete property test')
                return
            }

            const person = listResponse.results[0]

            // The endpoint returns 202 Accepted — the property is deleted asynchronously
            const result = await deletePropertyTool.handler(context, {
                id: person.id,
                $unset: 'mcp_test_prop_nonexistent',
            })

            expect(result).toBeTruthy()
        })
    })

    describe('persons workflow', () => {
        it('should support list, retrieve, get values, and get cohorts', async () => {
            const listTool = GENERATED_TOOLS['persons-list']!()
            const retrieveTool = GENERATED_TOOLS['persons-retrieve']!()
            const valuesTool = GENERATED_TOOLS['persons-values-retrieve']!()
            const cohortsTool = GENERATED_TOOLS['persons-cohorts-retrieve']!()

            // List persons
            const listResult = await listTool.handler(context, { limit: 5 })
            const listResponse = parseToolResponse(listResult)
            expect(Array.isArray(listResponse.results)).toBe(true)

            if (listResponse.results.length === 0) {
                console.warn('No persons found in project, skipping workflow test')
                return
            }

            // Retrieve a specific person
            const person = listResponse.results[0]
            const retrieveResult = await retrieveTool.handler(context, { id: person.id })
            const retrieved = parseToolResponse(retrieveResult)
            expect(retrieved.id).toBe(person.id)
            expect(retrieved.distinct_ids).toBeTruthy()

            // Get property values
            const valuesResult = await valuesTool.handler(context, { key: 'email' })
            const valuesResponse = parseToolResponse(valuesResult)
            expect(Array.isArray(valuesResponse)).toBe(true)

            // Get cohorts for the person
            const cohortsResult = await cohortsTool.handler(context, { person_id: String(person.id) })
            const cohortsResponse = parseToolResponse(cohortsResult)
            expect(Array.isArray(cohortsResponse)).toBe(true)
        })
    })
})
