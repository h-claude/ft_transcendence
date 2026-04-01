import { Component, mountComponent } from "../Component.js";
import { MenuDropdown } from "./MenuDropdown.js";
import { LogoutButton } from "../components/LogoutButton.js";

export class Header extends Component {
	private title: string = "Header";

	render(): string {

		const showHomeButton = this.title !== "Home";

		return `
			<header class="p-2 text-center text-xl font-bold neon-border-main-div flex items-center h-16 gap-2">
				${showHomeButton ? `<a href="/" class="flex items-center gap-2 text-white font-medium py-2 px-4 rounded-xl shadow-md transition" style="background-color: #9333ea;">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24" class="w-5 h-5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 9.75L12 4l9 5.75M4.5 10.5v8.25h15V10.5" />
					</svg>Home</a>` : `<div></div>`}
				<div class="ad-space-left flex-1 h-14">
					<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
				</div>
				<a id="titleLink" class="flex-shrink-0 whitespace-nowrap neon-text animate-neon">Nemscendance</a>
				<div class="ad-space-right flex-1 h-14">
					<!--<img src="/assets/pub.gif" class="w-full h-full object-fill"/>-->
				</div>
				<div id="menuDropdownComp" class="neutral flex-shrink-0"></div>
			</header>
		`;
	}

	afterRender(...args: any[]): void
	{

		if (args && args.length > 0 && args[0])
		{
			this.title = String(args[0]).trim();
			if (this.element){
				this.element.innerHTML = this.render();
			}

		}

		//this.attachTitleClickEvent();
		mountComponent(MenuDropdown, "menuDropdownComp");
	}

	private attachTitleClickEvent(): void
	{
		const titleLink = document.getElementById("titleLink");
		if (titleLink)
		{
			titleLink.addEventListener("click", (e) =>
			{
				e.preventDefault();
				location.reload();
			})
		}
	}
}
