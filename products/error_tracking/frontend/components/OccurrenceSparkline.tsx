import { useValues } from 'kea'
import { useCallback, useMemo } from 'react'

import { getColorVar } from 'lib/colors'
import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { AnyScaleOptions, Sparkline } from 'lib/components/Sparkline'
import { dayjs } from 'lib/dayjs'

import { themeLogic } from '~/layout/navigation-3000/themeLogic'

import { useDefaultSparklineColorVars, useSparklineOptions } from '../hooks/use-sparkline-options'
import { SparklineData, SparklineOptions } from './SparklineChart/SparklineChart'

let cachedSpikePattern: CanvasPattern | null = null

function getSpikePattern(): CanvasPattern | null {
    if (cachedSpikePattern) {
        return cachedSpikePattern
    }

    const size = 6
    const patternCanvas = document.createElement('canvas')
    patternCanvas.width = size
    patternCanvas.height = size
    const pctx = patternCanvas.getContext('2d')
    if (!pctx) {
        return null
    }

    const spikeColor = getColorVar('brand-yellow')
    pctx.fillStyle = spikeColor
    pctx.fillRect(0, 0, size, size)

    pctx.strokeStyle = 'rgba(255,255,255,0.35)'
    pctx.lineWidth = 2
    pctx.beginPath()
    pctx.moveTo(-1, 1)
    pctx.lineTo(1, -1)
    pctx.moveTo(0, size)
    pctx.lineTo(size, 0)
    pctx.moveTo(size - 1, size + 1)
    pctx.lineTo(size + 1, size - 1)
    pctx.stroke()

    const resolveCanvas = document.createElement('canvas')
    resolveCanvas.width = 1
    resolveCanvas.height = 1
    const resolveCtx = resolveCanvas.getContext('2d')
    cachedSpikePattern = resolveCtx?.createPattern(patternCanvas, 'repeat') ?? null
    return cachedSpikePattern
}

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
        const spikePattern = getSpikePattern()

        if (spikePattern) {
            series.barColors = data.map((datum) => {
                const datumTime = datum.date.getTime()
                const hasSpikeInBin = spikeTimestamps.some((st) => st >= datumTime && st < datumTime + binSizeMs)
                return hasSpikeInBin ? spikePattern : options.backgroundColor
            })
        }
    }

    return [series]
}
