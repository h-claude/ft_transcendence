import { Component, mountComponent } from "../Component.js";
import { navigate } from "../navigation.js";
import { WebSocketManager } from "../WebSocketManager.js";
import { UserStore } from "../store.js";
import { SettingsImagesEmitter } from "./Settings/Images/SettingsImagesEmitter.js";
import { ChatUIEmitter } from "./Chat/ChatUIEmitter.js";
import { ChatSocket } from "./Chat/ChatSocket.js";
import { GlobalSocket } from "../GlobalSocket.js";

export class MenuDropdown extends Component {
	render(): string {
	    return `
<div class="relative always-in-front">

	<!-- Rectangular dropdown button with image + username -->
	<button id="dropdownButton" class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 focus:outline-none">
		<img id="menuDropdownProfilePic" alt="Profile" class="w-8 h-8 rounded-full object-cover" />
		<span id="menuDropdownUsername">Username</span>
	</button>

	<!-- Dropdown Menu -->
	<div id="dropdownMenu" class="absolute right-0 mt-2 w-48 bg-slate-950 border border-gray-700 rounded-lg shadow-lg hidden">
		<a id="ddmProfileButton" class="rainbow-text-hover block px-4 py-2 hover:bg-gray-700 cursor-pointer">Profile</a>
		<a id="ddmSettingsButton" class="rainbow-text-hover block px-4 py-2 hover:bg-gray-700 cursor-pointer">Settings</a>
		<a id="logoutButton" class="rainbow-text-hover block px-4 py-2 text-red-400 hover:bg-gray-700 cursor-pointer">Logout</a>
	</div>

</div>

		`;
	}

	async afterRender() {
		const button = document.getElementById("dropdownButton")!;
		const menu = document.getElementById("dropdownMenu")!;
		const profileButton = document.getElementById("ddmProfileButton")!;
		const settingsButton = document.getElementById("ddmSettingsButton")!;
		const usernameSpan = document.getElementById("menuDropdownUsername")!;
		var us = UserStore.getInstance().getUser();
		if (!us) {
			return ;
		}

		const renderPicture = async () => {
			if (!us?.userImageInfos.hasProfilePicture) {
				fetch('/api/images/defaultPp', {
					method: "GET",
					credentials: "include"
				}).then(response => response.blob())
				  .then(blob => {
						const url = URL.createObjectURL(blob);
						const lol = document.getElementById("menuDropdownProfilePic")! as HTMLImageElement;
						lol.src = url;
				})
			} else {
				const lol = document.getElementById("menuDropdownProfilePic")! as HTMLImageElement;
				if (!us.userImageInfos.profilePicture) {
					console.log("pas de profile picture");
					return ;
				}
				lol.src = us.userImageInfos.profilePicture;
			}
		}
		renderPicture();
		SettingsImagesEmitter.getInstance().addEventListener("profilePictureChanged", async () => {
			await renderPicture();
		})

		const renderUsername = async() => {
			usernameSpan.innerHTML = `${us?.username} ▼`;
		}
		await renderUsername();

		UserStore.getInstance().addEventListener("change", async () => {
			await UserStore.getInstance().resetUser();
			us = UserStore.getInstance().getUser();
			renderUsername();
		});

		button.addEventListener("click", () => {
			menu.classList.toggle("hidden");
		});

		document.addEventListener("click", (event) => {
			if (!button.contains(<Node | null>event.target) && !menu.contains(<Node | null>event.target)) {
				menu.classList.add("hidden");
			}
		});

		profileButton.addEventListener("click", async (event) => {
			ChatUIEmitter.getInstance().removeTrackedListeners();
			const t = await ChatSocket.getInstance();
			t.destroyListeners();
			t.destroyInstance();
			navigate("/profile");
		})

		settingsButton.addEventListener("click", async (event) => {
			ChatUIEmitter.getInstance().removeTrackedListeners();
			const t = await ChatSocket.getInstance();
			t.destroyListeners();
			t.destroyInstance();
			navigate("/settings");
		})

		document.getElementById("logoutButton")?.addEventListener('click', async function () {
			const data = {lol: 'lol', haha: 'haha'};
			const ws = await WebSocketManager.getInstance();
			await ws.close();
			ws.destroyInstance();
			const response = await fetch ("/api/logout", {
				method: "POST",
				headers: {"Content-Type": "application/json"},
				credentials: "include",
				body: JSON.stringify(data)
			});
			ChatUIEmitter.getInstance().removeTrackedListeners();
			const t = await ChatSocket.getInstance();
			t.destroyListeners();
			t.destroyInstance();
			const globalSocket = await GlobalSocket.getInstance();
			globalSocket.destroyListeners();
			globalSocket.destroySocket();
			globalSocket.destroyInstance();
			navigate("/");
		})
	}
}
