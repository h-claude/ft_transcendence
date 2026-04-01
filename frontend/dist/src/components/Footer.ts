import { Component } from "../Component.js";

export class Footer extends Component {
	render(): string {
		return `
			<footer class="p-4 text-center neon-border-main-div">Footer</footer>
		`;
	}

	afterRender(): void {
	}
}
