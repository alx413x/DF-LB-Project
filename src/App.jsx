import { useState } from 'react'
import Layout from "./components/Layout";
import Header from "./components/Header";

function AppContent() {

  return (
    <Layout>
      {/* header */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">

      </main>
    </Layout>
  )
}
function App() {

}

export default App
