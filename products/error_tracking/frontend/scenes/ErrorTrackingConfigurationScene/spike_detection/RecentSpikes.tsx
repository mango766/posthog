import { useActions, useValues } from 'kea'
import { useEffect } from 'react'
import { P, match } from 'ts-pattern'

import { IconSort } from '@posthog/icons'
import { LemonTable, LemonTableColumns, Link } from '@posthog/lemon-ui'

import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { TZLabel } from 'lib/components/TZLabel'
import { IconArrowDown, IconArrowUp } from 'lib/lemon-ui/icons'
import { urls } from 'scenes/urls'

import { SpikeEventOrder, recentSpikesLogic } from './recentSpikesLogic'

export function RecentSpikes(): JSX.Element {
    const { loadRecentSpikes } = useActions(recentSpikesLogic)

    useEffect(() => {
        loadRecentSpikes()
    }, [loadRecentSpikes])

    // @ts-expect-error: typegen typing issue
    const { recentSpikes, spikesResponseLoading, pagination, order } = useValues(recentSpikesLogic)
    const { setOrder } = useActions(recentSpikesLogic)

    const columns: LemonTableColumns<ErrorTrackingSpikeEvent> = [
        {
            title: 'Issue',
            dataIndex: 'issue_name',
            render: (_, record) => (
                <Link to={urls.errorTrackingIssue(record.issue_id)}>{record.issue_name || 'Unknown issue'}</Link>
            ),
        },
        {
            title: (
                <SortingHeader sortOrder={order} setSortOrder={setOrder} columnKey="detected_at">
                    Detected at
                </SortingHeader>
            ),
            dataIndex: 'detected_at',
            render: (_, record) => <TZLabel time={record.detected_at} />,
        },
        {
            title: (
                <SortingHeader sortOrder={order} setSortOrder={setOrder} columnKey="computed_baseline">
                    Baseline
                </SortingHeader>
            ),
            dataIndex: 'computed_baseline',
            render: (_, record) => <span>{Math.round(record.computed_baseline)}</span>,
        },
        {
            title: (
                <SortingHeader sortOrder={order} setSortOrder={setOrder} columnKey="current_bucket_value">
                    Multiplier
                </SortingHeader>
            ),
            dataIndex: 'current_bucket_value',
            render: (_, record) => {
                const multiplier =
                    record.computed_baseline > 0
                        ? Math.round(record.current_bucket_value / record.computed_baseline)
                        : record.current_bucket_value
                return <span>{multiplier}x</span>
            },
        },
    ]

    return (
        <LemonTable<ErrorTrackingSpikeEvent>
            dataSource={recentSpikes}
            columns={columns}
            loading={spikesResponseLoading}
            pagination={pagination}
            emptyState={!spikesResponseLoading ? 'No spike events detected yet.' : undefined}
        />
    )
}

function SortingHeader({
    columnKey,
    sortOrder,
    setSortOrder,
    children,
}: {
    columnKey: SpikeEventOrder
    sortOrder: SpikeEventOrder
    setSortOrder: (order: SpikeEventOrder) => void
    children: React.ReactNode
}): JSX.Element {
    const isUsed = sortOrder.includes(columnKey)
    const order = sortOrder.startsWith('-') ? 'desc' : 'asc'
    const onToggle = (): void => {
        if (isUsed) {
            setSortOrder((order === 'asc' ? `-${columnKey}` : columnKey) as SpikeEventOrder)
        } else {
            setSortOrder(columnKey)
        }
    }
    return (
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggle}>
            <div className="font-semibold">{children}</div>
            {
                match([isUsed, order])
                    .with([true, 'asc'], () => <IconArrowUp />)
                    .with([true, 'desc'], () => <IconArrowDown />)
                    .with([false, P.any], () => <IconSort />)
                    .otherwise(() => null) as JSX.Element
            }
        </div>
    )
}
