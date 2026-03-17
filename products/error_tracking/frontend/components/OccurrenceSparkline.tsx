import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { Chart } from 'lib/Chart'
import { getColorVar } from 'lib/colors'
import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { AnyScaleOptions, Sparkline } from 'lib/components/Sparkline'
import { dayjs } from 'lib/dayjs'

import { useDefaultSparklineColorVars, useSparklineOptions } from '../hooks/use-sparkline-options'
import { SparklineData, SparklineOptions } from './SparklineChart/SparklineChart'

const STRIPE_SIZE = 12

function createSpikePatternCanvas(): HTMLCanvasElement {
    const s = STRIPE_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = s
    canvas.height = s
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        return canvas
    }

    ctx.fillStyle = getColorVar('brand-yellow')
    ctx.fillRect(0, 0, s, s)

    // Equal-width diagonal stripes: (x+y) % s >= s/2 selects every other band in the `/` direction
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
            if ((x + y) % s >= s / 2) {
                ctx.fillRect(x, y, 1, 1)
            }
        }
    }

    return canvas
}

let sharedPatternCanvas: HTMLCanvasElement | null = null

function createSpikePattern(): CanvasPattern | null {
    if (!sharedPatternCanvas) {
        sharedPatternCanvas = createSpikePatternCanvas()
    }
    // Each instance needs its own CanvasPattern so setTransform() doesn't affect others
    const ctx = document.createElement('canvas').getContext('2d')
    return ctx?.createPattern(sharedPatternCanvas, 'repeat') ?? null
}

function hasSpikeInBin(datumTime: number, binSizeMs: number, spikeTimestamps: number[]): boolean {
    return spikeTimestamps.some((st) => st >= datumTime && st < datumTime + binSizeMs)
}

function buildSeriesData(
    data: SparklineData,
    options: SparklineOptions,
    spikeEvents: ErrorTrackingSpikeEvent[],
    spikePattern: CanvasPattern | null
): any[] {
    const series: any = {
        values: data.map((d) => d.value),
        name: 'Occurrences',
        color: options.backgroundColor,
        hoverColor: options.hoverBackgroundColor,
    }

    if (spikeEvents.length > 0 && data.length >= 2 && spikePattern) {
        const binSizeMs = data[1].date.getTime() - data[0].date.getTime()
        const spikeTimestamps = spikeEvents.map((s) => new Date(s.detected_at).getTime())
        series.barColors = data.map((datum) =>
            hasSpikeInBin(datum.date.getTime(), binSizeMs, spikeTimestamps) ? spikePattern : options.backgroundColor
        )
    }

    return [series]
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
    spikeEvents?: ErrorTrackingSpikeEvent[]
}): JSX.Element {
    const colorVars = useDefaultSparklineColorVars()
    const options = useSparklineOptions({
        backgroundColor: colorVars[0],
        hoverBackgroundColor: colorVars[1],
    })

    const chartInstanceRef = useRef<Chart | null>(null)
    const spikePatternRef = useRef<CanvasPattern | null>(null)
    const hasSpikes = spikeEvents.length > 0

    const [occurrences, labels, labelRenderer] = useMemo(() => {
        const pattern = hasSpikes ? createSpikePattern() : null
        spikePatternRef.current = pattern

        return [
            buildSeriesData(data, options, spikeEvents, pattern),
            data.map((value) => dayjs(value.date).toISOString()),
            (label: string) => dayjs(label).format('D MMM YYYY HH:mm (UTC)'),
        ]
    }, [data, options, spikeEvents, hasSpikes])

    useEffect(() => {
        if (!hasSpikes) {
            return
        }

        let frameId: number
        let offset = 0
        const speed = STRIPE_SIZE / 140

        const animate = (): void => {
            offset = (offset + speed) % STRIPE_SIZE
            const pattern = spikePatternRef.current
            const chart = chartInstanceRef.current
            if (pattern && chart?.canvas) {
                pattern.setTransform(new DOMMatrix().translateSelf(0, -offset))
                chart.update('none')
            }
            frameId = requestAnimationFrame(animate)
        }

        frameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(frameId)
    }, [hasSpikes])

    const withXScale = useCallback(
        (scale: AnyScaleOptions) =>
            ({
                ...scale,
                type: 'timeseries',
                ticks: { display: true, maxRotation: 0, maxTicksLimit: 5, font: { size: 10, lineHeight: 1 } },
                time: { unit: 'day', displayFormats: { day: 'D MMM' } },
            }) as AnyScaleOptions,
        []
    )

    return (
        <Sparkline
            className={className}
            data={occurrences}
            labels={labels}
            renderLabel={labelRenderer}
            withXScale={displayXAxis ? withXScale : undefined}
            chartInstanceRef={chartInstanceRef}
        />
    )
}
