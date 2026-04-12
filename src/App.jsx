import { useState } from 'react';
import { LendingProvider } from "./context/LendingProvider.jsx";
import Layout from "./components/Layout";
import Header from "./components/Header";
import Toast from "./components/Toast";
import DashboardView from "./components/views/DashboardView";
import MarketsView from "./components/views/MarketsView";
import LiquidationsView from "./components/views/LiquidationsView";

function AppContent() {
  const[activeTab, setActiveTab] = useState("dashboard");

  return (
    <Layout>
      {/* header */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "markets" && <MarketsView />}
        {activeTab === "liquidations" && <LiquidationsView />}
      </main>

      <Toast />
    </Layout>
  );
}

function App() {
  return (
    <LendingProvider>
      <AppContent />
    </LendingProvider>
  );
}

export default App;
