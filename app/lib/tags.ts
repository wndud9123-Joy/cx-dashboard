// 케어드 태그 목록 (flat name)
export const CARED_TAGS = new Set([
  "수거일변경", "반품수거일정", "종료절차", "판매가능상품", "판매불가사유",
  "환불일정", "반품절차", "차란백분실", "준비절차", "회원탈퇴", "반품취소",
  "합반품", "배송일정", "판매내역", "배송전취소", "검수일정", "판매정보수정_전시시작",
  "기존백수거", "개인정보", "쿠폰", "kg판매", "수거확인", "결제수단", "수거취소",
  "수거방법", "반품가능문의", "할인", "차란백추가요청", "반품판매재개",
  "신청방법_판매활성", "이벤트지급_구매활성", "상품상세정보", "하자제보",
  "판매정보수정_상품화", "수거개수변경", "차란백배송일정", "차란백종류",
  "기타문의_상품탐색", "차란백취소", "계좌오류", "서비스오류", "kg판매지급",
  "이벤트문의_구매활성", "kg판매신청방법", "단말기오류", "수수료_판매활성",
  "환불금액", "합배송", "가품신고", "기부", "판매철회_전시시작", "배송지변경",
  "수거시간_옷장정리수거", "기타문의_판매정산", "NFS처리변경", "정품확인",
  "회수지변경_전시종료", "기타", "신상업데이트", "개선제안", "회수배송비_전시종료",
  "미선택귀속_상품화", "판매자보상", "누락상품확인_전시시작", "오배송", "배송일변경",
  "수거지변경", "오수거_옷장정리수거", "앱설치", "판매철회_상품화", "쿠폰재발급",
  "누락상품확인_상품화", "종료처리변경", "크레딧전환", "회수상품확인_전시종료",
  "무료반품", "회수배송일정_전시종료", "회수배송비_상품화", "남자옷", "구매자보상",
  "누락배송", "오수거_반품", "알림거부", "회수상품확인_상품화", "상태값변경",
  "기타문의_옷장정리수거", "차란백배송지변경", "구매확정", "기부일정", "kg판매요청",
  "연장", "첫구매_반품", "첫구매_상품탐색", "수수료_구매확정", "회수배송일정_상품화",
  "판매시작일정", "회수지변경_반품", "기타문의_판매활성", "미선택귀속_전시종료",
  "회수지변경_상품화", "수거시간_반품", "이벤트지급_판매활성", "이벤트문의_판매활성",
  "친구초대_구매활성", "입금확인", "기타문의_반품", "쿠폰적용", "반품배송비",
  "기부자변경", "기타문의_상품화", "기타문의_판매가능상품", "기타문의_전시시작",
  "알림", "등급", "반품분실", "전환취소", "친구초대_판매활성",
]);

// 케어드 소분류: 판매 / 구매 / 기타
const CARED_SELL_KEYWORDS = [
  "판매", "kg판매", "수수료_판매", "이벤트지급_판매", "이벤트문의_판매",
  "기타문의_판매", "친구초대_판매", "신청방법_판매", "판매철회", "판매정보수정",
  "판매시작", "반품판매재개", "판매자보상",
];

const CARED_BUY_KEYWORDS = [
  "구매", "첫구매", "수수료_구매", "이벤트지급_구매", "이벤트문의_구매",
  "친구초대_구매", "구매자보상", "구매확정",
];

export function classifyCaredSubSegment(tag: string): "판매" | "구매" | "기타" {
  for (const kw of CARED_SELL_KEYWORDS) {
    if (tag.includes(kw)) return "판매";
  }
  for (const kw of CARED_BUY_KEYWORDS) {
    if (tag.includes(kw)) return "구매";
  }
  return "기타";
}

// 마켓 태그: prefix 기반
export function isMarketTag(tag: string): boolean {
  return tag.startsWith("공통/") || tag.startsWith("구매자/") || tag.startsWith("판매자/");
}

export function classifyMarketSubSegment(tag: string): "판매자" | "구매자" | "공통" {
  if (tag.startsWith("판매자/")) return "판매자";
  if (tag.startsWith("구매자/")) return "구매자";
  return "공통";
}

export type Segment = "케어드" | "마켓" | "미분류";
export type SubSegment = "판매" | "구매" | "기타" | "판매자" | "구매자" | "공통";

export function classifyTag(tag: string): { segment: Segment; subSegment: SubSegment } {
  if (isMarketTag(tag)) {
    return { segment: "마켓", subSegment: classifyMarketSubSegment(tag) };
  }
  if (CARED_TAGS.has(tag)) {
    return { segment: "케어드", subSegment: classifyCaredSubSegment(tag) };
  }
  return { segment: "미분류", subSegment: "기타" };
}
