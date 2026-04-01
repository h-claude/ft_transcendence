import { Component } from "../Component.js";
import { mountComponent } from "../Component.js";
import { Header } from "../components/Header.js";
import { Footer } from "../components/Footer.js";
import { WebSocketManager } from "../WebSocketManager.js";
import { UserStore } from "../store.js";
import { SettingsImages } from "../components/SettingsImages.js";
import { SettingsCredentials } from "../components/SettingsCredentials.js";
import { SettingsTwoFactor } from "../components/SettingsTwoFactor.js";

export class Settings extends Component {
	render(): string {
		return `
			<div class="min-h-screen flex flex-col font-mono home-main-div">
				<div id="headerComp" class="neutral"></div>
			</header>
<div class="bg-gradient-to-br from-[#0d041f] via-[#1f0b3e] to-[#3c1053] text-gray-200 p-6 md:p-10 flex flex-col items-center">

  <h1 class="font-orbitron text-4xl md:text-6xl font-bold text-fuchsia-300 mb-12 md:mb-16 text-glow-fuchsia tracking-wider">
    ACCOUNT CONFIGURATION
  </h1>

  <!-- Visual Customization Section -->
  <div id="settingsImagesComp" class="neutral"></div>

  <!-- Account Credentials Section -->
  <div id="settingsCredentialsComp" class="neutral"></div>

  <!-- Two-Factor Authentication -->
  <div id="settingsTwoFactorComp" class="neutral"></div>
</div>


				</div>
				<div id="footerComp" class="neutral"></div>
			</div>
		`;
	}

	afterRender() {
		mountComponent(Header, "headerComp", "Settings");
		mountComponent(Footer, "footerComp");
		mountComponent(SettingsImages, "settingsImagesComp");
		mountComponent(SettingsCredentials, "settingsCredentialsComp");
		mountComponent(SettingsTwoFactor, "settingsTwoFactorComp");
	}
}
