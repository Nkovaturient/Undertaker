import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '../context/walletContext'
import { findPaths } from '../utils/pathFinder'
import { PRICE_AWARE_ROUTER_ABI } from '../utils/abi'

export default function SwapPanel({ deployed, chainId }) {
  const { wallet } = useWallet()
  const [fromToken, setFromToken] = useState('HTS-EVM')
  const [toToken, setToToken] = useState('HBAR')
  const [amount, setAmount] = useState('')
  const [paths, setPaths] = useState([])
  const [selectedPath, setSelectedPath] = useState(null)
  const [quote, setQuote] = useState(null)

  useEffect(() => {
    const pools = mockPools()
    const found = findPaths(pools, fromToken, toToken, 3)
    setPaths(found)
    setSelectedPath(found[0] || null)
  }, [fromToken, toToken])

  async function computeQuote(path) {
    const simulated = simulateSwapAmount(path, amount || '0')
    setQuote(simulated)
  }

  async function doSwap() {
    if (!deployed?.PriceAwareRouter) return alert('Router not loaded')
    if (!wallet.account) return alert('Connect a wallet first')

    try {
      if (wallet.walletType === 'MetaMask') {
        const signer = await wallet.provider.getSigner()
        const router = new ethers.Contract(deployed.PriceAwareRouter, PRICE_AWARE_ROUTER_ABI, signer)
        const amountIn = ethers.parseUnits(amount || '0', 18)
        const tx = await router.swapExactTokensForTokens(amountIn, 0, [])
        alert('Swap sent: ' + tx.hash)
        await tx.wait()
        alert('Swap confirmed')
      }

      if (wallet.walletType === 'HashPack') {
        // Build Hedera transaction (HTS transfer or contract call)
        const { ContractExecuteTransaction } = await import('@hashgraph/sdk')
        const tx = await new ContractExecuteTransaction()
          .setContractId(deployed.PriceAwareRouter)
          .setGas(200000)
          .setFunction('swapExactTokensForTokensViaAMM', null) // supply params via SDK
        const res = await wallet.hashconnect.sendTransaction(wallet.topic, {
          topic: wallet.topic,
          byteArray: tx.toBytes(),
          metadata: { accountToSign: wallet.account, returnTransaction: false }
        })
        console.log('HashPack swap result', res)
        alert('Swap request sent to HashPack')
      }
    } catch (e) {
      console.error(e)
      alert('Swap failed: ' + e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="p-2 border rounded">
          <option>HBAR</option>
          <option>USDC</option>
          <option>HTS-ABC</option>
          <option>HTS-DEF</option>
        </select>
      </div>

      <div className="flex gap-2">
        <input className="flex-1 p-2 border rounded" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <button onClick={() => setAmount('1000')} className="px-4 py-2 rounded bg-hedera-500 text-white">MAX</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => computeQuote(selectedPath)} className="px-4 py-2 rounded bg-hedera-500 text-white">Get Quote</button>
        <button onClick={doSwap} disabled={!wallet.account} className="px-4 py-2 rounded border disabled:opacity-50">
          {wallet.account ? 'Swap' : 'Connect Wallet'}
        </button>
      </div>

      {quote && (
        <div className="p-3 rounded bg-hedera-50">
          <div className="text-sm">Estimated out: <strong>{quote}</strong></div>
        </div>
      )}
    </div>
  )
}

function mockPools() {
  return {
    'HTS-ABC': [{ to: 'HBAR', rIn: 100000, rOut: 500 }, { to: 'USDC', rIn: 10000, rOut: 25000 }],
    'HBAR': [{ to: 'HTS-ABC', rIn: 500, rOut: 100000 }, { to: 'USDC', rIn: 20000, rOut: 10000 }],
    'USDC': [{ to: 'HBAR', rIn: 10000, rOut: 20000 }, { to: 'HTS-ABC', rIn: 25000, rOut: 10000 }]
  }
}

function simulateSwapAmount(path, amount) {
  if (!path) return null
  let amt = Number(amount)
  if (isNaN(amt)) return null
  for (let i = 0; i < path.length - 1; i++) amt = amt * 0.95
  return amt.toFixed(6)
}
