// Fichier : script/deploy.js

// 'hre' (Hardhat Runtime Environment) est injecté automatiquement
// lorsque le script est exécuté avec 'npx hardhat run'.
// Il contient 'ethers' qui est déjà configuré pour le bon réseau.
async function main() {
  // 1. Obtenir le compte de déploiement
  // Hardhat utilise automatiquement le premier compte de la liste 'accounts'
  // dans hardhat.config.js pour le réseau choisi.
  const [deployer] = await hre.ethers.getSigners();
  console.log("🔑 Déploiement du contrat avec le compte :", deployer.address);

  // 2. Afficher le solde du compte (utile pour vérifier)
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Solde du compte :", hre.ethers.formatEther(balance), "AVAX");

  // 3. Déployer le contrat
  console.log("Déploiement du contrat ScoreStorage...");
  const scoreStorage = await hre.ethers.getContractFactory("ScoreStorage");
  const contract = await scoreStorage.deploy();

  // 4. Attendre que le déploiement soit finalisé
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log("✅ Contrat ScoreStorage déployé à l'adresse :", contractAddress);
  console.log("👑 Owner :", await contract.owner());
  console.log("🌐 Réseau :", hre.network.name);
}

// Modèle recommandé pour la gestion des erreurs avec async/await
main().catch((error) => {
  console.error("💥 Une erreur est survenue :", error);
  process.exitCode = 1;
});
