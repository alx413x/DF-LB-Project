import HeroStats from "../HeroStats";
import PositionSummaryBar from "../PositionSummaryBar";
import AssetTable from "../AssetTable";
import TransactionHistory from "../TransactionHistory";

export default function DashboardView() {
  return (
    <>
      <HeroStats />
      <PositionSummaryBar />
      <div className="space-y-6">
        <AssetTable type="supply" />
        <AssetTable type="borrow" />
      </div>
      <TransactionHistory />
    </>
  );
}
