// backend/blockchain_form/script/generateWallet.js  (CommonJS)
const { randomBytes } = require("crypto");
const { writeFileSync } = require("fs");
const { join } = require("path");

async function loadEthers() {
  try {
    return await import("ethers");
  } catch (e) {
    try {
      // fallback si la résolution "exports" foire
      return await import("ethers/dist/ethers.js");
    } catch (_) {
      throw e; // remonte l'erreur initiale pour le log
    }
  }
}

async function generateWallet(uid) {
  if (!uid) throw new Error("❌ UID manquant : impossible de générer le wallet.");

  const { HDNodeWallet, Mnemonic } = await loadEthers();

  const entropy = randomBytes(16);
  const mnemonic = Mnemonic.fromEntropy(entropy);
  const wallet = HDNodeWallet.fromMnemonic(mnemonic);

  const walletData = {
    uid,
    mnemonic: mnemonic.phrase,
    address: wallet.address,
    privateKey: wallet.privateKey,
  };

  console.log("✅ Wallet généré !");
  console.log(walletData);
  return walletData;
}

if (require.main === module) {
  (async () => {
    const uid = process.argv[2];
    if (!uid) {
      console.error("❌ Utilisation : node blockchain_form/script/generateWallet.js <UID>");
      process.exit(1);
    }
    const data = await generateWallet(uid);
    const outputPath = join(process.cwd(), `wallet_${uid}.json`);
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`💾 Sauvegardé dans : ${outputPath}`);
  })();
}

module.exports = { generateWallet };
