import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { findPaths } from '../utils/pathFinder'
import { PRICE_AWARE_ROUTER_ABI } from '../utils/abi'


export default function SwapPanel({ deployed, chainId }) {
    const [fromToken, setFromToken] = useState('HTS-ABC')
    const [toToken, setToToken] = useState('HBAR')
    const [amount, setAmount] = useState('')
    const [maxMode, setMaxMode] = useState(false)
    const [mode, setMode] = useState('SPEND') // or RECEIVE
    const [paths, setPaths] = useState([])
    const [selectedPath, setSelectedPath] = useState(null)
    const [quote, setQuote] = useState(null)
    const [provider, setProvider] = useState(null)


    useEffect(() => {
        // create an ethers provider from window.ethereum for simplistic interactions
        if (window.ethereum) setProvider(new ethers.BrowserProvider(window.ethereum))
    }, [])


    useEffect(() => {
        // recompute paths when tokens or amount change
        const pools = mockPools()
        const found = findPaths(pools, fromToken, toToken, 3)
        setPaths(found)
        setSelectedPath(found[0] || null)
    }, [fromToken, toToken])


    async function computeQuote(path) {
        // Use MockAMM reserves to simulate quote calculation locally.
        // In production call contract view functions with provider.
        const simulated = simulateSwapAmount(path, amount || '0')
        setQuote(simulated)
    }


    async function doSwap() {
        if (!deployed || !deployed.PriceAwareRouter) return alert('Router not loaded')
        if (!provider) return alert('Connect a wallet')


        const signer = await provider.getSigner()
        const router = new ethers.Contract(deployed.PriceAwareRouter, PRICE_AWARE_ROUTER_ABI, signer)


        // Example: simpleSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, bytes path)
        try {
            const amountIn = ethers.parseUnits(amount || '0', 18)
            const tx = await router.swapExactTokensForTokens(amountIn, 0, [] /* path placeholder */)
            alert('Swap sent: ' + tx.hash)
            await tx.wait()
            alert('Swap confirmed')
        } catch (e) {
            console.error(e)
            alert('Swap failed: ' + e.message)
        }
    }


    function handleMax() {
        // This demo uses a mocked wallet balance; in production query token contract's balanceOf(account)
        setAmount('1000')
        setMaxMode(true)
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
                <button onClick={handleMax} className="px-4 py-2 rounded bg-hedera-500 text-white">MAX</button>
            </div>


            <div className="flex items-center gap-2">
                <button onClick={() => setMode('SPEND')} className={`px-3 py-1 rounded ${mode === 'SPEND' ? 'bg-hedera-600 text-white' : 'border'}`}>Spend</button>
                <button onClick={() => setMode('RECEIVE')} className={`px-3 py-1 rounded ${mode === 'RECEIVE' ? 'bg-hedera-600 text-white' : 'border'}`}>Receive</button>
            </div>


            <div>
                <div className="text-sm text-slate-500 mb-2">Found paths:</div>
                <div className="space-y-2">
                    {paths.length === 0 && <div className="text-sm text-slate-400">No paths found</div>}
                    {paths.map((p, i) => (
                        <div key={i} className={`p-2 rounded border ${selectedPath === p ? 'bg-hedera-50' : ''}`} onClick={() => setSelectedPath(p)}>
                            <div className="font-medium">Path {i + 1}</div>
                            <div className="text-xs text-slate-600">{p.join(' → ')}</div>
                        </div>
                    ))}
                </div>
            </div>


            <div className="flex gap-2">
                <button onClick={() => computeQuote(selectedPath)} className="px-4 py-2 rounded bg-hedera-500 text-white">Get Quote</button>
                <button onClick={doSwap} className="px-4 py-2 rounded border">Swap</button>
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
    // Return a graph: map token -> list of {pairToken, reserveIn, reserveOut}
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
    // naive constant-product with 0.3% fee
    for (let i = 0; i < path.length - 1; i++) {
        // simplistic: swap amt using fixed reserves
        amt = amt * 0.95 // just degrade by fee for demo
    }
    return amt.toFixed(6)
}
