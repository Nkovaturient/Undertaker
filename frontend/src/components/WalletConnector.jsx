// import React, { useEffect, useState } from 'react'
// import { ethers } from 'ethers'
// import {HashConnect} from 'hashconnect'
// import { LedgerId } from '@hashgraph/sdk'


// export default function WalletConnector() {
//     const [hashconnect, setHashconnect] = useState(null)
//     const [account, setAccount] = useState(null)
//     const [walletType, setWalletType] = useState(null)
//     const [topic, setTopic] = useState(null)
//     const [provider, setProvider] = useState(null)


//     useEffect(() => {
//         // Try MetaMask
//         if (window.ethereum) {
//             const p = new ethers.BrowserProvider(window.ethereum)
//             setProvider(p)
//         }
//     }, [])

//     async function connectMetaMask() {
//         try {
//             if (!window.ethereum) throw new Error('MetaMask not found')
//             await window.ethereum.request({ method: 'eth_requestAccounts' })
//             const p = new ethers.BrowserProvider(window.ethereum)
//             const signer = await p.getSigner()
//             const addr = await signer.getAddress()
//             setProvider(p)
//             setAccount(addr)
//             setWalletType('MetaMask')
//         } catch (e) {
//             console.error(e)
//             alert('MetaMask connect failed: ' + e.message)
//         }
//     }

//     // Init HashConnect once
//     useEffect(() => {
//         const appMetadata = {
//             name: 'Undretaker DApp',
//             description: 'Swap Router Demo',
//             icon: window.location.origin + '/logo.png'
//         }

//         const hc = new HashConnect(LedgerId.TESTNET, 'undretaker-dapp', appMetadata, true)
//         setHashconnect(hc)

//         hc.pairingEvent.on((pairingData) => {
//             console.log('Wallet paired', pairingData)
//             setAccount(pairingData.accountIds[0])
//             setTopic(pairingData.topic)
//             setWalletType('HashPack')
//             localStorage.setItem('hashpackPairing', JSON.stringify(pairingData))
//         })

//         hc.connectionStatusChangeEvent.on((status) => {
//             console.log('Connection status', status)
//         })

//         // Try restore session
//         const saved = localStorage.getItem('hashpackPairing')
//         if (saved) {
//             const pairing = JSON.parse(saved)
//             setAccount(pairing.accountIds[0])
//             setTopic(pairing.topic)
//             setWalletType('HashPack')
//         }
//     }, [])

//     async function connectHashPack() {
//         if (!hashconnect) return
//         try {
//             await hashconnect.init()
//             await hashconnect.connect() // shows QR if no saved pairing
//         } catch (err) {
//             console.error(err)
//             alert('HashPack connection failed')
//         }
//     }

//     async function sendTransaction(tx) {
//         if (!hashconnect || !topic || !account) throw new Error('Wallet not connected')
//         const res = await hashconnect.sendTransaction(
//             topic,
//             {
//                 topic,
//                 byteArray: tx.toBytes(),
//                 metadata: {
//                     accountToSign: account,
//                     returnTransaction: false,
//                     hideNft: false
//                 }
//             }
//         )
//         console.log('Wallet signed tx', res)
//         return res
//     }

//     return (
//         <div className="flex items-center gap-4">
//             {account ? (
//                 <div className="px-4 py-2 rounded bg-hedera-100">
//                     {walletType}: {short(account)}
//                 </div>
//             ) : (
//                 <div className="flex gap-2">
//                     <button onClick={connectHashPack} className="px-4 py-2 rounded bg-hedera-500 text-white">
//                         HashPack
//                     </button>
//                     <button onClick={connectMetaMask} className="px-4 py-2 rounded border border-hedera-500 text-hedera-700">MetaMask Snap</button>
//                 </div>
//             )}
//         </div>
//     )
// }

// function short(addr) {
//     if (!addr) return ''
//     return `${addr.slice(0, 6)}...${addr.slice(-4)}`
// }


import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { HashConnect } from 'hashconnect'
import { LedgerId } from '@hashgraph/sdk'
import { useWallet } from '../context/WalletContext'
import { QRCodeCanvas } from 'qrcode.react'

export default function WalletConnector() {
  const { wallet, setWallet } = useWallet()
  const [pairingString, setPairingStr] = useState(null)

  // Initialize MetaMask provider if present
  useEffect(() => {
    if (window.ethereum && !wallet.provider) {
      const p = new ethers.BrowserProvider(window.ethereum)
      setWallet((w) => ({ ...w, provider: p }))
    }
  }, [wallet.provider, setWallet])

  useEffect(() => {
    const saved = localStorage.getItem('hashpackPairing')
    if (saved) {
      const pairingData = JSON.parse(saved)
      setWallet((w) => ({
        ...w,
        account: pairingData.accountIds[0],
        walletType: 'HashPack',
        topic: pairingData.topic,
      }))
    }
  }, [setWallet])

  async function connectMetaMask() {
    try {
      if (!window.ethereum) throw new Error('MetaMask not found')
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const p = new ethers.BrowserProvider(window.ethereum)
      const signer = await p.getSigner()
      const addr = await signer.getAddress()
      setWallet({
        provider: p,
        account: addr,
        walletType: 'MetaMask',
        hashconnect: null,
        topic: null,
      })
    } catch (e) {
      console.error(e)
      alert('MetaMask connect failed: ' + e.message)
    }
  }

  async function connectHashPack() {
    try {
      const appMetadata = {
        name: 'Undretaker DApp',
        description: 'Price-Aware Router Demo',
        icon: window.location.origin + '/logo.png',
      }
      const projectID = `${import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID}`

      const hc = new HashConnect(LedgerId.TESTNET, projectID, appMetadata, true)

      hc.pairingEvent.on((pairingData) => {
        console.log('Wallet paired', pairingData)
        if (pairingData.accountIds.length > 0) {
            setWallet({
              provider: null,
              account: pairingData.accountIds[0],
              walletType: "HashPack",
              hashconnect: hc,
              topic: pairingData.topic,
            });
            localStorage.setItem("hashpackPairing", JSON.stringify(pairingData));
            setPairingStr(null) // hide QR after pairing
        }
        });

      hc.connectionStatusChangeEvent.on((status) => {
        console.log('HashPack connection status', status)
      })

      await hc.init()
      const ps = await hc.pairingString;
      setPairingStr(ps);
      console.log("Pairing string:", ps);
    } catch (e) {
      console.error(e)
      alert('HashPack connect failed: ' + e.message)
    }
  }

  function disconnect() {
    setWallet({
      provider: null,
      account: null,
      walletType: null,
      hashconnect: null,
      topic: null,
    })
    localStorage.removeItem('hashpackPairing')
    setPairingStr(null)
  }

  return (
    <div className="flex items-center gap-4">
      {wallet.account ? (
        <div className="flex items-center gap-2 px-4 py-2 rounded bg-hedera-100">
          {wallet.walletType}: {short(wallet.account)}
          <button
            onClick={disconnect}
            className="ml-2 px-2 py-1 rounded bg-red-500 text-white text-xs"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            onClick={connectHashPack}
            className="px-4 py-2 rounded bg-hedera-500 text-white"
          >
            HashPack
          </button>
          <button
            onClick={connectMetaMask}
            className="px-4 py-2 rounded border border-hedera-500 text-hedera-700"
          >
            MetaMask Snap
          </button>
        </div>
        {pairingString && (
            <div className="p-4 rounded border bg-white shadow">
              <div className="text-sm mb-2">Scan with HashPack:</div>
              <QRCodeCanvas value={pairingString} size={180} />
            </div>
          )}
          </div>
      )}
    </div>
  )
}

function short(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
