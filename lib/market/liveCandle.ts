import { INTERVAL_SECONDS, type Interval } from "@/lib/constants";
import type { Candle } from "./types";

/**
 * 체결가(틱)를 현재 타임프레임의 진행 중인 봉에 합쳐 준다.
 *
 * 거래소 웹소켓의 kline(캔들) 스트림이 끊기거나 지연되는 환경에서도
 * 마지막 봉이 실시간으로 움직이도록, 호가/체결가 틱을 받아
 * open·high·low·close·volume을 갱신한다. REST 폴링 결과는 merge()로
 * 합쳐서 공식 거래량·고가·저가를 보정한다.
 */
export class LiveCandleBuilder {
  private readonly step: number;
  private current: Candle | null = null;

  constructor(interval: Interval) {
    this.step = INTERVAL_SECONDS[interval];
  }

  get last(): Candle | null {
    return this.current ? { ...this.current } : null;
  }

  /** REST에서 받아온 캔들 목록으로 기준 봉을 잡는다. (초기 로드) */
  seed(candles: Candle[]): void {
    const last = candles[candles.length - 1];
    if (last && Number.isFinite(last.close)) {
      this.current = { ...last };
    }
  }

  /**
   * REST에서 받아온 마지막 봉을 현재 봉에 합친다.
   * 같은 봉이면 고가/저가/거래량만 보정하고(틱이 더 최신인 종가는 유지),
   * 더 새로운 봉이면 그 봉으로 교체한다.
   */
  merge(candle: Candle): Candle | null {
    if (!Number.isFinite(candle.close)) return null;
    const cur = this.current;
    if (!cur || candle.time > cur.time) {
      this.current = { ...candle };
      return this.last;
    }
    if (candle.time < cur.time) return this.last;
    cur.open = candle.open;
    cur.high = Math.max(cur.high, candle.high);
    cur.low = Math.min(cur.low, candle.low);
    cur.volume = Math.max(cur.volume, candle.volume);
    return this.last;
  }

  /**
   * 가격 틱을 반영한다. 새 봉이 시작되면 직전 봉의 마감본과 새 봉을
   * 순서대로 돌려준다. (차트에서는 앞 봉은 갱신, 뒤 봉은 추가로 처리된다)
   */
  push(price: number, timeMs: number, qty = 0): Candle[] {
    if (!Number.isFinite(price) || price <= 0) return [];
    const bucket = Math.floor(timeMs / 1000 / this.step) * this.step;
    const cur = this.current;
    const out: Candle[] = [];

    if (!cur || bucket > cur.time) {
      if (cur) out.push({ ...cur });
      this.current = {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: qty > 0 ? qty : 0,
      };
      out.push({ ...this.current });
      return out;
    }

    // 늦게 도착한(이전 봉) 틱은 무시한다.
    if (bucket < cur.time) return [];

    cur.high = Math.max(cur.high, price);
    cur.low = Math.min(cur.low, price);
    cur.close = price;
    if (qty > 0) cur.volume += qty;
    out.push({ ...cur });
    return out;
  }
}

/** 숫자 문자열을 안전하게 number로 (빈 값/이상값은 NaN) */
export function toNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/** 여러 후보 중 처음으로 유효한 숫자를 고른다. (거래소 필드명 변경 대응) */
export function firstNum(...values: unknown[]): number {
  for (const value of values) {
    const num = toNum(value);
    if (Number.isFinite(num)) return num;
  }
  return NaN;
}
