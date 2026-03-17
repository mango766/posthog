import { useValues } from 'kea'
import { Form } from 'kea-forms'

import { LemonBanner } from '@posthog/lemon-ui'

import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonField } from 'lib/lemon-ui/LemonField'
import { LemonInput } from 'lib/lemon-ui/LemonInput'
import { LemonSkeleton } from 'lib/lemon-ui/LemonSkeleton'

import { RecentSpikes } from './RecentSpikes'
import { spikeDetectionConfigLogic } from './spikeDetectionConfigLogic'

export function SpikeDetectionSettings(): JSX.Element {
    const { configLoading, configFormChanged, isConfigFormSubmitting } = useValues(spikeDetectionConfigLogic)

    if (configLoading) {
        return (
            <div className="space-y-4">
                <LemonSkeleton className="w-full h-10" />
                <LemonSkeleton className="w-full h-10" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <Form logic={spikeDetectionConfigLogic} formKey="configForm" enableFormOnSubmit className="space-y-4">
                <LemonBanner type="info" action={{ children: 'Send feedback', id: 'spike-detection-feedback-button' }}>
                    <p>
                        Spike detection is in early stage. We may make changes to the defaults or replace these settings
                        as we iterate. We'd love your feedback!
                    </p>
                </LemonBanner>

                <p className="text-muted-foreground">
                    Configure spike detection settings for error tracking alerts. When an issue receives significantly
                    more exceptions than its baseline, a spike alert will be triggered.
                </p>

                <div className="grid grid-cols-3 gap-4">
                    <LemonField name="snooze_duration_minutes" label="Snooze duration (minutes)">
                        <LemonInput
                            type="number"
                            min={1}
                            placeholder="10"
                            fullWidth
                            data-attr="spike-detection-snooze-duration"
                        />
                    </LemonField>

                    <LemonField name="multiplier" label="Multiplier">
                        <LemonInput
                            type="number"
                            min={1}
                            placeholder="10"
                            fullWidth
                            data-attr="spike-detection-multiplier"
                        />
                    </LemonField>

                    <LemonField name="threshold" label="Minimum threshold">
                        <LemonInput
                            type="number"
                            min={1}
                            placeholder="500"
                            fullWidth
                            data-attr="spike-detection-threshold"
                        />
                    </LemonField>
                </div>

                <div className="flex justify-end">
                    <LemonButton
                        type="primary"
                        htmlType="submit"
                        disabledReason={!configFormChanged ? 'No changes to save' : undefined}
                        loading={isConfigFormSubmitting}
                    >
                        Save
                    </LemonButton>
                </div>
            </Form>

            <div>
                <h3 className="font-semibold mb-2">Recent spikes</h3>
                <RecentSpikes />
            </div>
        </div>
    )
}
