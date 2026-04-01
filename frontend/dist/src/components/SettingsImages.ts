import { Component } from "../Component.js";
import { SettingsImagesUi } from "./Settings/Images/SettingsImagesUi.js";

export class SettingsImages extends Component {
	render(): string {
		return `
	<div class="w-full max-w-5xl mb-16">
		<h2 class="font-orbitron text-2xl md:text-3xl font-bold text-cyan-300 mb-8 text-glow-cyan tracking-wide text-center md:text-left">
				Visual Interface Settings
		</h2>
		<div class="grid gap-10 md:gap-12 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

				<!-- Profile Picture Card -->
				<div class="card-glow bg-black/30 backdrop-blur-lg border border-fuchsia-500/30 rounded-2xl p-6 flex flex-col items-center">
					<div class="relative mb-5">
							<img id="settingsProfileImg" Picture" class="w-28 h-28 rounded-full object-cover border-4 border-fuchsia-500 shadow-lg">
							<div class="absolute inset-0 rounded-full border-2 border-cyan-400/70 animate-pulse" style="animation-duration: 3s;"></div>
							<div class="absolute inset-1 rounded-full border border-fuchsia-400/70 animate-pulse" style="animation-duration: 2.5s; animation-delay: 0.5s;"></div>
					</div>
					<h3 class="text-xl font-semibold text-cyan-300 mb-5 tracking-wide">Avatar</h3>
					<div class="flex flex-col gap-3 w-full">
						<button id="settingsProfileImgSyncDefault" class="button-glow w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider text-white">
							Sync Default
						</button>
						<label class="upload-label w-full text-center cursor-pointer bg-white/5 hover:bg-fuchsia-500/15 py-2.5 rounded-lg text-sm border border-fuchsia-500/50 hover:border-fuchsia-500 transition-colors text-fuchsia-300 hover:text-fuchsia-200 font-semibold flex items-center justify-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
							Upload Image
							<input type="file" class="hidden" id="settingsProfileImgUpload" accept="image/*">
						</label>
					</div>
				</div>

				<!-- Card Image Card -->
				<div class="card-glow bg-black/30 backdrop-blur-lg border border-fuchsia-500/30 rounded-2xl p-6 flex flex-col items-center">
					 <div class="relative mb-5">
							<img id="settingsCardImg" Card" class="w-28 h-28 rounded-xl object-cover border-4 border-fuchsia-500 shadow-lg">
							<div class="absolute inset-0 rounded-xl border-2 border-cyan-400/70 animate-pulse" style="animation-duration: 3s; animation-delay: 0.2s;"></div>
					</div>
					<h3 class="text-xl font-semibold text-cyan-300 mb-5 tracking-wide">Identity Card</h3>
					<div class="flex flex-col gap-3 w-full">
						<button id="settingsCardImgSyncDefault" class="button-glow w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider text-white">
							Sync Default
						</button>
						<label class="upload-label w-full text-center cursor-pointer bg-white/5 hover:bg-fuchsia-500/15 py-2.5 rounded-lg text-sm border border-fuchsia-500/50 hover:border-fuchsia-500 transition-colors text-fuchsia-300 hover:text-fuchsia-200 font-semibold flex items-center justify-center gap-2">
							 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
							Upload Image
							<input id="settingsCardImgUpload" type="file" class="hidden" accept="image/*">
						</label>
					</div>
				</div>

				<!-- Profile Background Card -->
				<div class="card-glow bg-black/30 backdrop-blur-lg border border-fuchsia-500/30 rounded-2xl p-6 flex flex-col items-center">
					 <div class="relative mb-5">
							<img id="settingsBgImg" class="w-28 h-28 rounded-lg object-cover border-4 border-fuchsia-500 shadow-lg">
							<div class="absolute inset-0 rounded-lg border-2 border-cyan-400/70 animate-pulse" style="animation-duration: 3s; animation-delay: 0.4s;"></div>
					</div>
					<h3 class="text-xl font-semibold text-cyan-300 mb-5 tracking-wide">Background Grid</h3>
					<div class="flex flex-col gap-3 w-full">
						<button id="settingsBgImgSyncDefault" class="button-glow w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider text-white">
							Sync Default
						</button>
						<label class="upload-label w-full text-center cursor-pointer bg-white/5 hover:bg-fuchsia-500/15 py-2.5 rounded-lg text-sm border border-fuchsia-500/50 hover:border-fuchsia-500 transition-colors text-fuchsia-300 hover:text-fuchsia-200 font-semibold flex items-center justify-center gap-2">
							 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
							Upload Image
							<input id="settingsGbImgUpload" type="file" class="hidden" accept="image/*">
						</label>
					</div>
				</div>
		</div>
	</div>
		`;
	}
	async afterRender(...args: any[]) {
		const settingsImagesUi = new SettingsImagesUi();
		await settingsImagesUi.renderProfileImage();
		await settingsImagesUi.renderCardImage();
		await settingsImagesUi.renderBackgroundImage();
		await settingsImagesUi.setupListeners();
	}
}
