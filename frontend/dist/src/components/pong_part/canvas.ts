// canvas.ts – Création et gestion responsive du canvas principal du jeu

export const canvasElement = document.createElement("canvas");
export const gameContainerElement = document.createElement("div");

// Applique la classe CSS pour le conteneur (centré, taille adaptative)
gameContainerElement.classList.add("game-container");

// Attribue un ID au canvas (pour CSS et debug)
canvasElement.id = "pong";

// Ajoute le canvas dans le conteneur HTML, puis dans la page
gameContainerElement.appendChild(canvasElement);
document.getElementById("app")?.appendChild(gameContainerElement);

// Fonction pour adapter la résolution réelle du canvas à sa taille affichée
export function resizeCanvasToDisplaySize(): void {
  console.log(`width: ${canvasElement.clientWidth} && ${canvasElement.clientHeight}`)
  // canvasElement.width = canvasElement.clientWidth;
  // canvasElement.height = canvasElement.clientHeight;
  canvasElement.width = 1196;
  canvasElement.height = 559;
}

// Initialisation + resize auto à chaque redimensionnement
resizeCanvasToDisplaySize();
window.addEventListener("resize", resizeCanvasToDisplaySize);
