require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Ajout pour charger les variables d'environnement

// Récupération de la clé privée et de l'URL RPC depuis le fichier .env
const FUJI_RPC_URL = process.env.FUJI_RPC_URL;
const FUJI_PRIVATE_KEY = process.env.FUJI_PRIVATE_KEY;

// Vérification que les variables sont bien présentes
if (!FUJI_RPC_URL) {
  throw new Error("Veuillez définir FUJI_RPC_URL dans votre fichier .env");
}
if (!FUJI_PRIVATE_KEY) {
  throw new Error("Veuillez définir FUJI_PRIVATE_KEY dans votre fichier .env");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Configuration pour le réseau local de développement Hardhat
    hardhat: {
      chainId: 1337,
    },
    // Nouvelle configuration pour le testnet Fuji
    fuji: {
      url: FUJI_RPC_URL,
      accounts: [FUJI_PRIVATE_KEY],
      chainId: 43113, // Le Chain ID de Fuji est 43113
    },
  },
};
