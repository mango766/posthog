import { useValues } from 'kea'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { Chart } from 'lib/Chart'
import { getColorVar } from 'lib/colors'
import { ErrorTrackingSpikeEvent } from 'lib/components/Errors/types'
import { AnyScaleOptions, Sparkline } from 'lib/components/Sparkline'
import { dayjs } from 'lib/dayjs'

import { themeLogic } from '~/layout/navigation-3000/themeLogic'

import { useDefaultSparklineColorVars, useSparklineOptions } from '../hooks/use-sparkline-options'
import { SparklineData, SparklineOptions } from './SparklineChart/SparklineChart'

const STRIPE_SIZE = 6

function createSpikePatternCanvas(): HTMLCanvasElement {
    const patternCanvas = document.createElement('canvas')
    patternCanvas.width = STRIPE_SIZE
    patternCanvas.height = STRIPE_SIZE
    const pctx = patternCanvas.getContext('2d')
    if (!pctx) {
        return patternCanvas
    }

    const spikeColor = getColorVar('brand-yellow')
    pctx.fillStyle = spikeColor
    pctx.fillRect(0, 0, STRIPE_SIZE, STRIPE_SIZE)

    pctx.strokeStyle = 'rgba(255,255,255,0.35)'
    pctx.lineWidth = 2
    pctx.beginPath()
    pctx.moveTo(-1, 1)
    pctx.lineTo(1, -1)
    pctx.moveTo(0, STRIPE_SIZE)
    pctx.lineTo(STRIPE_SIZE, 0)
    pctx.moveTo(STRIPE_SIZE - 1, STRIPE_SIZE + 1)
    pctx.lineTo(STRIPE_SIZE + 1, STRIPE_SIZE - 1)
    pctx.stroke()

    return patternCanvas
}

let sharedPatternCanvas: HTMLCanvasElement | null = null

function getPatternCanvas(): HTMLCanvasElement {
    if (!sharedPatternCanvas) {
        sharedPatternCanvas = createSpikePatternCanvas()
    }
    return sharedPatternCanvas
}

function createSpikePattern(): CanvasPattern | null {
    const resolveCanvas = document.createElement('canvas')
    resolveCanvas.width = 1
    resolveCanvas.height = 1
    const resolveCtx = resolveCanvas.getContext('2d')
    return resolveCtx?.createPattern(getPatternCanvas(), 'repeat') ?? null
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

    const chartInstanceRef = useRef<Chart | null>(null)
    const spikePatternRef = useRef<CanvasPattern | null>(null)
    const hasSpikes = spikeEvents.length > 0

    const [occurrences, labels, labelRenderer] = useMemo(() => {
        let pattern: CanvasPattern | null = null
        if (hasSpikes) {
            pattern = createSpikePattern()
            spikePatternRef.current = pattern
        }

        return [
            wrapDataWithColor(data, options, spikeEvents, pattern),
            data.map((value) => dayjs(value.date).toISOString()),
            (label: string) => {
                return dayjs(label).format('D MMM YYYY HH:mm (UTC)')
            },
        ]
    }, [data, options, spikeEvents, hasSpikes])

    // Animate the stripe pattern only for sparklines that have spikes
    useEffect(() => {
        if (!hasSpikes) {
            return
        }

        let animationFrameId: number
        let offset = 0
        const speed = STRIPE_SIZE / 100

        const animate = (): void => {
            offset = (offset + speed) % STRIPE_SIZE
            const pattern = spikePatternRef.current
            const chart = chartInstanceRef.current
            if (pattern && chart?.canvas) {
                pattern.setTransform(new DOMMatrix().translateSelf(0, -offset))
                chart.update('none')
            }
            animationFrameId = requestAnimationFrame(animate)
        }

        animationFrameId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animationFrameId)
    }, [hasSpikes])

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
            chartInstanceRef={chartInstanceRef}
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
    spikeEvents: ErrorTrackingSpikeEvent[] = [],
    spikePattern: CanvasPattern | null = null
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

        series.barColors = data.map((datum) => {
            const datumTime = datum.date.getTime()
            const hasSpikeInBin = spikeTimestamps.some((st) => st >= datumTime && st < datumTime + binSizeMs)
            return hasSpikeInBin ? spikePattern : options.backgroundColor
        })
    }

    return [series]
}
