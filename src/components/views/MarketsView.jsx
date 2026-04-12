import { useState } from "react";
import { useLendingContext } from "../../context/useLendingContext";
import MarketOverview from "../markets/MarketOverview";
import InterestRateCurve from "../markets/InterestRateCurve";
import MarketStatsPanel from "../markets/MarketStatsPanel";
import APYHistoryChart from "../charts/APYHistoryChart";
import UtilizationChart from "../charts/UtilizationChart";

export default function MarketsView() {
  const { assets } = useLendingContext();
  const [selectedAsset, setSelectedAsset] = useState(assets[0]?.symbol || "USDC");

  const asset = assets.find((a) => a.symbol === selectedAsset) || assets[0];

  return (
    <>
      <MarketOverview
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InterestRateCurve asset={asset} />
        <MarketStatsPanel asset={asset} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <APYHistoryChart selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
        <UtilizationChart selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
      </div>
    </>
  );
}
