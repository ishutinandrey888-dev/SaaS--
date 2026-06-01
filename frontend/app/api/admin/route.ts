import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    metrics: {
      mrr: 842000,
      leads: 1248,
      conversion: 12.4,
      cac: 1930
    }
  });
}
