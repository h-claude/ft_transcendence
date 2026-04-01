import { Component } from "../Component.js";
import { UserStore } from "../store.js";
import { SettingsCredentialsAPI } from "./Settings/Credentials/SettingsCredentialsAPI.js";
import { SettingsCredentialsUi } from "./Settings/Credentials/SettingsCredentialsUi.js";

export class SettingsCredentials extends Component {
	render(): string {
		return (`
  <div class="w-full max-w-3xl mb-16">
    <h2 class="font-orbitron text-2xl md:text-3xl font-bold text-cyan-300 mb-8 text-glow-cyan tracking-wide text-center md:text-left">
        Account Credentials
    </h2>
    <div class="bg-black/30 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
        <form action="#" method="POST">
			<div id="errorDivInputCredentials" class="grid justify-center text-red-400 hidden">
			</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">

			<!-- Username -->
			<div class="relative">
				<label for="username" class="flex items-center gap-2 text-sm font-semibold text-fuchsia-300 uppercase tracking-wider mb-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
				Username
				</label>
				<input id="usernameInputCredentials" type="text" name="username" value="CurrentUsername" placeholder="YourGridHandle" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500">

				<!-- Popup message -->
				<div id="usernameValidInputCredentials" class="absolute left-0 mt-1 w-full text-xs text-green-400 bg-black bg-opacity-80 p-2 rounded-md shadow-lg z-10 hidden">
				</div>
			</div>

                <!-- Email -->
				<div class="relative">
					<div>
						<label for="email" class="flex items-center gap-2 text-sm font-semibold text-fuchsia-300 uppercase tracking-wider mb-2">
						   <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
							Email Address
						</label>
						<input id="emailInputCredentials" type="email" name="email" value="current.email@domain.net" placeholder="nexus@domain.net" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500">
					</div>
					<!-- Popup message -->
					<div id="emailValidInputCredentials" class="absolute left-0 mt-1 w-full text-xs text-green-400 bg-black bg-opacity-80 p-2 rounded-md shadow-lg z-10 hidden">
					</div>
				</div>
            </div>

            <!-- Password Change -->
			<div class="relative">
				<div class="mb-6">
					<label class="flex items-center gap-2 text-sm font-semibold text-fuchsia-300 uppercase tracking-wider mb-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
						Change Password (Optional)
					</label>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<input type="password" id="currentPasswordInputCredentials" name="current_password" placeholder="Current Password" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500">
						<input type="password" id="newPasswordInputCredentials" name="new_password" placeholder="New Password" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500">
						<input type="password" id="confimPasswordInputCredentials" name="confirm_password" placeholder="Confirm New Password" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500">
					</div>
					 <p class="text-xs text-purple-300/70 mt-2 pl-1">Leave blank if you don't want to change the password.</p>
				</div>
				<!-- Popup message -->
				<div id="passwordValidInputCredentials" class="absolute left-0 mt-1 w-full text-xs text-green-400 bg-black bg-opacity-80 p-2 rounded-md shadow-lg z-10 hidden">
				</div>
			</div>

             <!-- Divider -->
            <hr class="border-t border-purple-500/20 my-8">

            <!-- Save Changes Button -->
            <div class="flex justify-center mt-6">
                <button id="settingsSaveChangesButton" type="submit" class="button-glow w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 py-3 px-10 rounded-lg text-base font-bold uppercase tracking-wider text-white transition-all duration-300 ease-in-out" style="box-shadow: 0 0 8px rgba(34, 211, 238, 0.5), 0 0 8px rgba(59, 130, 246, 0.4);">
                    Update
				</button>
            </div>

        </form>
    </div>

		`);
	}

	afterRender(...args: any[]): void {
		const u = UserStore.getInstance().getUser(); if (!u) return;
		const settingsCredentialsUi = new SettingsCredentialsUi();

		settingsCredentialsUi.fillInputsWithDefault(u);

		settingsCredentialsUi.setupListener(u);

	}
}
