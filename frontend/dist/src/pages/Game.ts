import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { UserStore } from "../store.js";
import { Game } from "../components/Game.js";
import { WebSocketManager } from "../WebSocketManager.js";
import { GlobalEmitter } from "../GlobalEmitter.js";

export class GamePage extends Component {
	render(): string {
		return `
			<div id="gameComp" class="neutral">
		`;
	}

	async afterRender(...args: any[]): Promise<void> {
		mountComponent(Game, "gameComp");
	}
}

