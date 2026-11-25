import type { MultiAssetIndex, MultiAssetPack } from './types'

export async function loadMultiAssetIndex(): Promise<MultiAssetIndex> {
  const res = await fetch('/data/multi-asset/index.json')
  if (!res.ok) throw new Error(`Failed to load multi-asset index (${res.status})`)
  return res.json() as Promise<MultiAssetIndex>
}

export async function loadMultiAssetPack(fileKey: string): Promise<MultiAssetPack> {
  const res = await fetch(`/data/multi-asset/symbols/${encodeURIComponent(fileKey)}.json`)
  if (!res.ok) throw new Error(`Failed to load pack ${fileKey} (${res.status})`)
  return res.json() as Promise<MultiAssetPack>
}

export function fileKeyForSymbol(symbol: string): string {
  return symbol.replace(/=/g, '_').replace(/\//g, '_')
}
