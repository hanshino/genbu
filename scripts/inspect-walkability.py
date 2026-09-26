"""唯讀連通分量：python scripts/inspect-walkability.py sestage 1723。"""
import argparse
import math
import sqlite3
from collections import defaultdict


def components(mask, width, height):
    if width <= 0 or height <= 0 or len(mask) != width * height or set(mask) - {"0", "1"}:
        raise ValueError("可行走遮罩尺寸或內容不合法")
    labels = [-1] * len(mask)
    regions = []
    for start, value in enumerate(mask):
        if value != "1" or labels[start] != -1:
            continue
        labels[start] = len(regions)
        cells = [start]
        # 八鄰接，包含斜向；不推定遊戲是否禁止斜穿牆角。
        for cell in cells:
            row, col = divmod(cell, width)
            for y in range(max(0, row - 1), min(height, row + 2)):
                for x in range(max(0, col - 1), min(width, col + 2)):
                    other = y * width + x
                    if mask[other] == "1" and labels[other] == -1:
                        labels[other] = len(regions)
                        cells.append(other)
        regions.append(cells)
    return labels, regions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=["stage", "sestage"])
    parser.add_argument("stage", type=int)
    args = parser.parse_args()
    with sqlite3.connect("file:tthol.sqlite?mode=ro", uri=True) as con:
        row = con.execute("SELECT width,height,walk_mask,walkable_cells FROM map_walkability "
                          "WHERE stage_kind=? AND stage_id=?", (args.kind, args.stage)).fetchone()
        if row is None:
            parser.error("查無可行走資料")
        width, height, mask, expected = row
        labels, regions = components(mask, width, height)
        assert sum(map(len, regions)) == expected, "可行走格數不一致"
        placements = defaultdict(list)
        for category, npc, tag, x, y, name in con.execute(
            "SELECT p.category,p.npc_id,p.tag_id,p.raw_x,p.raw_y,n.name "
            "FROM map_placements p LEFT JOIN npc n ON n.id=p.npc_id "
            "WHERE p.stage_kind=? AND p.stage_id=? ORDER BY p.id", (args.kind, args.stage)
        ):
            col, row = (math.floor(x / 40), math.floor(y / 40)) if x is not None and y is not None else (-1, -1)
            label = labels[row * width + col] if 0 <= col < width and 0 <= row < height else -1
            placements[label].append(f"{category} 怪物={npc} {name or ''} 標籤={tag} 原始=({x},{y}) 格=({col},{row})")
        print(f"{args.kind} {args.stage}：{width}×{height}，八鄰接分量 {len(regions)}")
        for i, cells in enumerate(regions):
            cols, rows = [c % width for c in cells], [c // width for c in cells]
            print(f"\n分量 {i}：{len(cells)} 格，欄 {min(cols)}–{max(cols)}，列 {min(rows)}–{max(rows)}")
            print("\n".join(placements[i]) or "無配置物件")
        if placements[-1]:
            print("\n未落在可行走格（不自動吸附）：\n" + "\n".join(placements[-1]))


if __name__ == "__main__":
    # 最小自測：斜向相連、阻擋格與分離區域。
    labels, regions = components("100010001", 3, 3)
    assert len(regions) == 1 and labels[1] == -1
    assert len(components("101", 3, 1)[1]) == 2
    main()
