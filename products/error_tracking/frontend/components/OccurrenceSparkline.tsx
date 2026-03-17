import { useValues } from 'kea'
import { useCallback, useMemo } from 'react'

import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { AnyScaleOptions, Sparkline } from 'lib/components/Sparkline'
import { dayjs } from 'lib/dayjs'

import { themeLogic } from '~/layout/navigation-3000/themeLogic'

import { useDefaultSparklineColorVars, useSparklineOptions } from '../hooks/use-sparkline-options'
import { SparklineData, SparklineOptions } from './SparklineChart/SparklineChart'

export function OccurrenceSparkline({
    data,
    className,
    displayXAxis = false,
    spikeEvents = [],
}: {
    data: SparklineData
    className?: string
    displayXAxis?: boolean
    loading?: boolean
    spikeEvents?: ErrorTrackingSpikeEvent[]
}): JSX.Element {
    const colorVars = useDefaultSparklineColorVars()
    const options = useSparklineOptions({
        backgroundColor: colorVars[0],
        hoverBackgroundColor: colorVars[1],
    })
    const [occurrences, labels, labelRenderer] = useMemo(() => {
        return [
            wrapDataWithColor(data, options, spikeEvents),
            data.map((value) => dayjs(value.date).toISOString()),
            (label: string) => {
                return dayjs(label).format('D MMM YYYY HH:mm (UTC)')
            },
        ]
    }, [data, options, spikeEvents])

    const withXScale = useCallback((scale: AnyScaleOptions) => {
        return {
            ...scale,
            type: 'timeseries',
            ticks: {
                display: true,
                maxRotation: 0,
                maxTicksLimit: 5,
                font: {
                    size: 10,
                    lineHeight: 1,
                },
            },
            time: {
                unit: 'day',
                displayFormats: {
                    day: 'D MMM',
                },
            },
        } as AnyScaleOptions
    }, [])

    return (
        <Sparkline
            className={className}
            data={occurrences}
            labels={labels}
            renderLabel={labelRenderer}
            withXScale={displayXAxis ? withXScale : undefined}
        />
    )
}

export function useSparklineColors(): { color: string; hoverColor: string } {
    const { isDarkModeOn } = useValues(themeLogic)

    return useMemo(() => {
        return {
            color: isDarkModeOn ? 'primitive-neutral-600' : 'primitive-neutral-200',
            hoverColor: isDarkModeOn ? 'primitive-neutral-200' : 'primitive-neutral-700',
        }
    }, [isDarkModeOn])
}

const SPIKE_COLOR_VAR = 'brand-yellow'

function wrapDataWithColor(
    data: SparklineData,
    options: SparklineOptions,
    spikeEvents: ErrorTrackingSpikeEvent[] = []
): any[] {
    const series: any = {
        values: data.map((d) => d.value),
        name: 'Occurrences',
        color: options.backgroundColor,
        hoverColor: options.hoverBackgroundColor,
    }

    if (spikeEvents.length > 0 && data.length >= 2) {
        const binSizeMs = data[1].date.getTime() - data[0].date.getTime()
        const spikeTimestamps = spikeEvents.map((s) => new Date(s.detected_at).getTime())

        series.barColors = data.map((datum) => {
            const datumTime = datum.date.getTime()
            const hasSpikeInBin = spikeTimestamps.some((st) => st >= datumTime && st < datumTime + binSizeMs)
            return hasSpikeInBin ? SPIKE_COLOR_VAR : options.backgroundColor
        })
    }

    return [series]
}
