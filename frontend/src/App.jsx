import React, { useEffect, useState } from 'react'
import WalletConnector from './components/WalletConnector'
import SwapPanel from './components/SwapPanel'
import axios from 'axios'


export default function App() {
  const [deployed, setDeployed] = useState(null)
  const [chainId, setChainId] = useState(null)


  useEffect(() => {
    // Attempt to auto-load deployment info from out/deploy-<chainId>.json
    // Default to testnet chain id 296 for hedge.
    const defaultChainId = 296
    setChainId(defaultChainId)
    const path = `/out/deploy-${defaultChainId}.json`


    axios
      .get(path)
      .then((r) => {
        setDeployed(r.data)
      })
      .catch(() => {
        // fallback: try to fetch deploy-296, or leave null
        axios
          .get('/out/deploy-296.json')
          .then((r) => setDeployed(r.data))
          .catch(() => setDeployed(null))
      })
  }, [])


  return (
    <div className="min-h-screen bg-gradient-to-b from-hedera-50 to-white text-emerald-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/public/logo.svg" alt="logo" className="w-12 h-12" />
          <div>
            <h1 className="text-2xl font-bold">Undertaker</h1>
            <p className="text-sm text-slate-200">Hedera-native cross-chain AMM + CCIP router demo</p>
          </div>
        </div>
        <WalletConnector />
      </header>


      <main className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="p-6 rounded-2xl shadow-lg bg-white">
            <h2 className="text-xl font-semibold mb-4">Swap Panel</h2>
            <SwapPanel deployed={deployed} chainId={chainId} />
          </section>


          <section className="p-6 rounded-2xl shadow-lg bg-white">
            <h2 className="text-xl font-semibold mb-4">Insights & Tools</h2>
            <p className="text-sm text-slate-600 mb-3">Live price feed: Chainlink / HTS integration preview</p>
            <div className="space-y-3">
              <div className="p-3 rounded bg-hedera-50">Oracle status: <strong>connected</strong></div>
              <div className="p-3 rounded bg-hedera-50">CCIP router: <strong>{deployed ? deployed.PriceAwareRouter : 'not loaded'}</strong></div>
              <div className="p-3 rounded bg-hedera-50">Pathfinder test: run swaps to evaluate best routes</div>
            </div>
          </section>
        </div>


        <section className="mt-8 p-6 rounded-2xl shadow bg-white">
          <h3 className="font-medium text-lg mb-2">Workflow</h3>
          <ol className="list-decimal ml-6 text-sm text-slate-700">
            <li>Connect HashPack or MetaMask Snap</li>
            <li>Choose token & amount (use MAX to sell all)</li>
            <li>Pathfinder computes potential swap routes from available AMMs</li>
            <li>Contract call executes via PriceAwareRouter on Hedera</li>
            <li>Optionally route cross-chain via Chainlink CCIP</li>
          </ol>
        </section>
      </main>


      <footer className="text-center py-6 text-sm text-slate-500">
        Built with mild contempt and serious Hedera love.
      </footer>
    </div>
  )
}