import { Component, mountComponent } from "../Component.js";
import { navigate } from "../navigation.js";
import { MatchInfos } from "../types/game.js";
import { WebSocketManager } from "../WebSocketManager.js";
import { GameAPI } from "./Game/GameAPI.js";
import { GameUI } from "./Game/GameUI.js";
import { GameInit } from "./Game/GameInit.js";

export class Game extends Component {

  render(): string {
    return `
    <div id="game-body" class="game-body h-screen w-screen overflow-hidden flex items-center justify-center bg-black">
    <div class="w-full h-full flex items-center justify-center relative">

      <!-- Left Player Profile -->
      <div class="absolute left-6 top-1/2 transform -translate-y-1/2 flex flex-col items-center space-y-4">
        <div class="w-32 h-32 rounded-full overflow-hidden game-glow-border">
          <img id="gamePlayerOneImg" class="w-full h-full object-cover" />
        </div>
        <p id="gamePlayerOneName" class="text-base game-neon-text"></p>
      </div>

      <!-- Right Player Profile -->
      <div class="absolute right-6 top-1/2 transform -translate-y-1/2 flex flex-col items-center space-y-4">
        <div class="w-32 h-32 rounded-full overflow-hidden game-glow-border">
          <img id="gamePlayerTwoImg" alt="Player 2" class="w-full h-full object-cover" />
        </div>
        <p id="gamePlayerTwoName" class="text-base game-neon-text"></p>
      </div>

      <!-- Pong Game Canvas -->
      <canvas id="pong" width="1200" height="800" class="rounded-xl game-glow-border shadow-lg"></canvas>

      <!-- Decorative Neon Lines -->
      <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-purple-500 to-purple-900 opacity-20"></div>
      <div class="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-700 to-purple-900 opacity-10"></div>
    </div>

    <!-- Quit Game Button -->
    <button
      id="quitGameBtn"
      class="absolute top-6 right-6 px-5 py-2 rounded-lg text-sm font-semibold text-purple-300 border border-purple-500 bg-black/40 hover:bg-purple-800 hover:text-white transition-all duration-200 game-neon-text shadow-md shadow-purple-800/30"
    >
      Quit Game
    </button>
    </div>
    `;
  }

  async afterRender(...args: any[]): Promise<void> {
    const localMode = sessionStorage.getItem("pongMode") === "local";

    const gameUi = new GameUI();
    const gameInit = new GameInit();

    gameUi.renderBackground();
    gameUi.renderMapDim();

    if (localMode) {
      await gameUi.renderLocalSetup();
      await gameInit.start("local", "local");
      return;
    }

    const matchInfos: MatchInfos | Error = await GameAPI.getGameInfos();
    if (matchInfos instanceof Error) {
      console.warn("Error trying to get into the game");
      navigate("/");
      return;
    }

    const gameId = matchInfos.id;
    const opponentId = matchInfos.opponent_id;
    const matchType = matchInfos.type;
    const tournamentId = matchInfos.tournament_id ?? null;

    gameUi.setMatchInfos(matchInfos);
    await gameInit.start(String(gameId), String(opponentId), matchType, tournamentId);
    const side = await gameInit.waitForSide();
    console.log(`Side choisi: ${side}`);
    await gameUi.renderProfilePictures(matchInfos, side);
    await gameUi.renderUsernames(matchInfos, side);
  }
}
