import { useValues } from 'kea'

import { LemonSkeleton, LemonTable, Link } from '@posthog/lemon-ui'

import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { TZLabel } from 'lib/components/TZLabel'
import { urls } from 'scenes/urls'

import { recentSpikesLogic } from './recentSpikesLogic'

export function RecentSpikes(): JSX.Element {
    const { recentSpikes, recentSpikesLoading } = useValues(recentSpikesLogic)

    if (recentSpikesLoading) {
        return (
            <div className="space-y-2">
                <LemonSkeleton className="w-full h-10" />
                <LemonSkeleton className="w-full h-10" />
                <LemonSkeleton className="w-full h-10" />
            </div>
        )
    }

    if (recentSpikes.length === 0) {
        return <p className="text-muted-foreground italic">No spike events detected yet.</p>
    }

    return (
        <LemonTable<ErrorTrackingSpikeEvent>
            dataSource={recentSpikes}
            columns={[
                {
                    title: 'Issue',
                    dataIndex: 'issue_name',
                    render: (_, record) => (
                        <Link to={urls.errorTrackingIssue(record.issue_id)}>
                            {record.issue_name || 'Unknown issue'}
                        </Link>
                    ),
                },
                {
                    title: 'Detected at',
                    dataIndex: 'detected_at',
                    render: (_, record) => <TZLabel time={record.detected_at} />,
                },
                {
                    title: 'Baseline',
                    dataIndex: 'computed_baseline',
                    render: (_, record) => <span>{Math.round(record.computed_baseline)}</span>,
                },
                {
                    title: 'Actual',
                    dataIndex: 'current_bucket_value',
                },
            ]}
            emptyState="No spike events"
        />
    )
}
