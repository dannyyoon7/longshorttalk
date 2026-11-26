import { cn } from "@/lib/utils";

type AdSlotProps = {
  slot: string;
  format?: "banner" | "box";
  className?: string;
  label?: string;
};

/**
 * 비침해적 광고 슬롯 자리.
 * 실제 광고(예: Google AdSense)를 붙일 때 이 컴포넌트 안에 ins 태그를 넣으면 된다.
 * 거래 버튼·주문 패널 위에는 절대 겹치지 않도록 배치한다.
 */
export function AdSlot({ slot, format = "banner", className, label }: AdSlotProps) {
  return (
    <aside
      data-ad-slot={slot}
      aria-label="광고 영역"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line/80 bg-panel/40 text-center",
        format === "banner" ? "min-h-[88px] px-4 py-5" : "min-h-[220px] px-4 py-6",
        className,
      )}
    >
      <span className="rounded border border-line px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-muted">
        AD
      </span>
      <p className="mt-2 text-[12px] text-muted">{label ?? "광고 영역"}</p>
      <p className="mt-1 text-[10px] text-muted/70">
        비침해형 슬롯 · AdSense 연결 예정 (거래 화면 위에 겹치지 않습니다)
      </p>
    </aside>
  );
}
