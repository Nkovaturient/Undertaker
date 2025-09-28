import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import {HashConnect} from 'hashconnect'
import { LedgerId } from '@hashgraph/sdk'


export default function WalletConnector() {
    const [provider, setProvider] = useState(null)
    const [account, setAccount] = useState(null)
    const [walletType, setWalletType] = useState(null)


    useEffect(() => {
        // Try MetaMask
        if (window.ethereum) {
            const p = new ethers.BrowserProvider(window.ethereum)
            setProvider(p)
        }
    }, [])

    async function connectMetaMask() {
        try {
            if (!window.ethereum) throw new Error('MetaMask not found')
            await window.ethereum.request({ method: 'eth_requestAccounts' })
            const p = new ethers.BrowserProvider(window.ethereum)
            const signer = await p.getSigner()
            const addr = await signer.getAddress()
            setProvider(p)
            setAccount(addr)
            setWalletType('MetaMask')
        } catch (e) {
            console.error(e)
            alert('MetaMask connect failed: ' + e.message)
        }
    }


    async function connectHashPack() {
        try {
            const hashconnect = new HashConnect(LedgerId.TESTNET, "HTS-EVM01", appMetadata, true)
            const appMetadata = { name: 'Undertaker DApp', description: 'Swap Demo', icon: '' }
            // setUpHashConnectEvents();
            const initData = await hashconnect.init()
            const state = await hashconnect.connect() // shows pairing QR etc
            // This demo does not implement full HashPack integration — user completes pairing to expose accounts
            setWalletType('HashPack')
            setAccount(state.pairingData.accountIds?.[0] || null)
            // Note: integrate Hedera Ethers provider or hethers for signing in production
        } catch (e) {
            console.error(e)
            alert('HashPack connect failed: ' + e.message)
        }
    }


    return (
        <div className="flex items-center gap-4">
            {account ? (
                <div className="px-4 py-2 rounded bg-hedera-100">{walletType}: {short(account)}</div>
            ) : (
                <div className="flex gap-2">
                    <button onClick={connectHashPack} className="px-4 py-2 rounded bg-hedera-500 text-white">HashPack</button>
                    <button onClick={connectMetaMask} className="px-4 py-2 rounded border border-hedera-500 text-hedera-700">MetaMask Snap</button>
                </div>
            )}
        </div>
    )
}


function short(addr) {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}