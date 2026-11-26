"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { SYMBOL_META, type Symbol } from "@/lib/constants";
import type { Position } from "@/lib/engine/types";
import type { Candle } from "@/lib/market/types";

type Props = {
  symbol: Symbol;
  candles: Candle[];
  lastCandle: Candle | null;
  positions: Position[];
};

export default function TradingChart({ symbol, candles, lastCandle, positions }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastTimeRef = useRef<number>(0);
  const dataKeyRef = useRef<string>("");
  const meta = SYMBOL_META[symbol];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0E11" },
        textColor: "#848E9C",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(43,49,57,0.45)" },
        horzLines: { color: "rgba(43,49,57,0.45)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#5E6673", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2B3139" },
        horzLine: { color: "#5E6673", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#2B3139" },
      },
      rightPriceScale: {
        borderColor: "#2B3139",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "#2B3139",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
      },
      localization: {
        locale: "ko-KR",
        priceFormatter: (price: number) => price.toFixed(meta.pricePrecision),
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      watermark: {
        visible: true,
        text: "롱숏톡",
        color: "rgba(234,236,239,0.035)",
        fontSize: 46,
        fontStyle: "bold",
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#0ECB81",
      downColor: "#F6465D",
      borderUpColor: "#0ECB81",
      borderDownColor: "#F6465D",
      wickUpColor: "#0ECB81",
      wickDownColor: "#F6465D",
      priceFormat: {
        type: "price",
        precision: meta.pricePrecision,
        minMove: meta.tickSize,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      // 탭 전환 등으로 숨겨진 상태(0 크기)에서는 건너뛰고, 다시 보일 때 재조정한다.
      if (width <= 0 || height <= 0) return;
      chart.applyOptions({ width, height });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesRef.current = [];
      lastTimeRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 통화쌍이 바뀌면 가격 정밀도 갱신
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({
      priceFormat: { type: "price", precision: meta.pricePrecision, minMove: meta.tickSize },
    });
    chartRef.current?.applyOptions({
      localization: { priceFormatter: (price: number) => price.toFixed(meta.pricePrecision) },
    });
  }, [meta.pricePrecision, meta.tickSize]);

  // 초기/타임프레임 변경 시 전체 캔들
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    const mapped = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(mapped);
    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(14,203,129,0.35)" : "rgba(246,70,93,0.35)",
      })),
    );
    lastTimeRef.current = candles.length ? candles[candles.length - 1].time : 0;
    // 통화쌍·타임프레임이 바뀌어 새로 그린 경우에만 우측(현재)으로 이동한다.
    // (새 봉이 추가될 때마다 사용자가 보던 위치를 빼앗지 않도록)
    const key = `${symbol}:${candles[0]?.time ?? 0}`;
    if (candles.length && dataKeyRef.current !== key) {
      dataKeyRef.current = key;
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [candles, symbol]);

  // 실시간 마지막 캔들 (kline/체결가/호가 틱으로 계속 갱신)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!lastCandle || !candleSeries || !Number.isFinite(lastCandle.close)) return;
    if (lastCandle.time < lastTimeRef.current) return;
    lastTimeRef.current = lastCandle.time;
    try {
      candleSeries.update({
        time: lastCandle.time as UTCTimestamp,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });
      volumeSeriesRef.current?.update({
        time: lastCandle.time as UTCTimestamp,
        value: lastCandle.volume,
        color:
          lastCandle.close >= lastCandle.open
            ? "rgba(14,203,129,0.35)"
            : "rgba(246,70,93,0.35)",
      });
    } catch {
      /* 같은 시각 역방향 갱신 등 일시적 오류는 다음 틱에서 회복된다 */
    }
  }, [lastCandle]);

  // 포지션 가격선
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* noop */
      }
    }
    priceLinesRef.current = [];
    const mine = positions.filter((p) => p.symbol === symbol);
    for (const position of mine) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: position.entryPrice,
          color: "#FCD535",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `진입 ${position.side === "LONG" ? "롱" : "숏"} ${position.leverage}x`,
        }),
      );
      if (position.liquidationPrice > 0) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: position.liquidationPrice,
            color: "#F6465D",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "청산가",
          }),
        );
      }
      if (position.tp) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: position.tp,
            color: "#0ECB81",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: "TP",
          }),
        );
      }
      if (position.sl) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: position.sl,
            color: "#F0B90B",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: "SL",
          }),
        );
      }
    }
  }, [positions, symbol]);

  return <div ref={containerRef} className="h-full w-full" />;
}
