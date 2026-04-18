# Investor Wallet Integration & MetaMask Flow

We have successfully implemented the investor-facing wallet connection and investment flow on the frontend. The system now fully integrates MetaMask (via `ethers` v6) and wires the frontend smart contract calls to the backend `POST /api/v1/investments` endpoint.

## What Changed

### 1. Web3 Infrastructure & Contracts (`src/utils`)
- **`InvestmentPlatform.json`**: Extracted the compiled ABI from Hardhat into the frontend for direct use.
- **`contract.js`**: Created a factory that exports `getReadContract()` (for public RPC reads) and `getWriteContract(signer)` (for MetaMask-signed transactions), along with `maticToWei` and `weiToMatic` utilities.

### 2. Wallet State Management (`src/hooks/useWallet.js`)
- Created a robust custom hook that handles MetaMask's lifecycle events (`accountsChanged`, `chainChanged`).
- Exposes critical state properties: `isInstalled`, `isConnected`, `isCorrectChain`, `isConnecting`, `account`, and `chainId`. 
- Handles the network switch prompt via `wallet_switchEthereumChain` and automatic network addition for **Polygon Amoy** if the user doesn't have it configured.

### 3. UI Components (`src/components/`)
- **`WalletButton.jsx`**: A reusable, context-aware compact button. It automatically morphs depending on the wallet state ("Install MetaMask", "Connect Wallet", "Switch Network", or a pill showing the truncated wallet address).
- **`InvestModal.jsx`**: The centerpiece of the integration. This modal handles the complete, multi-step transaction process:
  - **Pre-flight Checks:** Enforces minimum/maximum bounds, prevents investing in closed campaigns.
  - **Connecting & Network verification:** Prompts connection and network switching cleanly.
  - **Blockchain Transaction:** Converts the amount, instantiates the write contract, pays `MATIC` to `contract.invest()`, and blocks until the block confirms (`tx.wait(1)`).
  - **Backend Recording:** Hits the `POST /api/v1/investments` API endpoint returning the transaction receipt in a stylish success panel with a direct link to PolygonScan.

### 4. Integration & Environment (`src/pages/CampaignDetail.jsx` & `.env.local`)
- Replaced the placeholder *"MetaMask coming soon"* button on the campaign detail page with the interactive `InvestModal` CTA. 
- The amount raised locally triggers an optimistic update when an investment completes so the user sees the progress bar advance seamlessly.
- Created `.env.local` setting `VITE_STUB_MODE=true` for safe local testing.

## Testing the Flow

You can test this right now without a real smart contract or real MATIC using the built-in "Stub Mode" we established.

### Stub Mode (No blockchain needed)
1. Ensure the backend is running (`npm run dev`) and frontend is refreshed to pick up `VITE_STUB_MODE=true` in `frontend/.env.local`.
2. Open a web browser to an active campaign on the Discover page.
3. Log in as an **investor**.
4. Click **"Invest in this Campaign"**. You will notice a yellow warning badge in the modal highlighting that you're in Stub Mode.
5. Provide a valid amount (respecting min/max goals) and click **"Record Investment (Stub)"**. 
6. Watch the backend immediately confirm it and automatically close the flow.

### Real Mode (MetaMask on Polygon Amoy)
*When you're ready to deploy the contract and use real Testnet MATIC:*
1. Change `VITE_STUB_MODE=false` in `frontend/.env.local`.
2. Change `DEV_SKIP_BLOCKCHAIN=false` in `backend/.env`.
3. Fill in `ALCHEMY_RPC_URL`, `ADMIN_WALLET_PRIVATE_KEY`, and `CONTRACT_ADDRESS` on the backend.
4. Fill in `VITE_CONTRACT_ADDRESS` on the frontend.
5. In your browser UI, click the Invest button. The system will guide you to authorize with MetaMask, verify the network, sign the transaction, and record the verified transaction explicitly against the chain event.
