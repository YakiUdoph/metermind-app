import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Contract } from "ethers";
import * as plugins from "@goatnetwork/agentkit/plugins";
import { getIdentityRegistryAddress, getReputationRegistryAddress } from "@goatnetwork/agentkit/plugins";

async function runProbe() {
  const identityRegistry = getIdentityRegistryAddress("goat-testnet");
  const reputationRegistry = getReputationRegistryAddress("goat-testnet");
  const provider = new JsonRpcProvider("https://rpc.testnet3.goat.network");

  const identityContract = new Contract(
    identityRegistry,
    ["function getAgentWallet(uint256 agentId) view returns (address)"],
    provider
  );
  
  const id = 99999;
  try {
    const walletAddress = await identityContract.getAgentWallet(id);
    console.log(`Agent ID ${id} Wallet: ${walletAddress}`);
  } catch (e: any) {
    console.log(`Agent ID ${id} query error: ${e.message}`);
  }
}

runProbe().catch(console.error);
