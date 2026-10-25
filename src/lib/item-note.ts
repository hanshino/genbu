// items.note 是遊戲裡的「未鑑定名稱」或分類備註。一半以上是「不明道具」「不明的頭具」
// 這類未鑑定名稱，列表上只是雜訊；詳情頁要標明它是什麼，不然看起來像道具本身的說明。
const UNIDENTIFIED_NOTE = /^(不明|未鑑定)/;

export function isUnidentifiedNote(note: string): boolean {
  return UNIDENTIFIED_NOTE.test(note);
}
