import { Component } from "../Component.js"
import { GlobalSocket } from "../GlobalSocket.js";
import { navigate } from "../navigation.js";
// import * as Comps from "../components/index.js"

export class Login extends Component {
	render(): string {
		return `
	<div class="min-h-screen flex items-center justify-center bg-cover bg-center" style="background-image: url('https://images2.alphacoders.com/109/1092728.jpg');">
		<div class="bg-purple-900 bg-opacity-50 text-white p-8 rounded-2xl shadow-2xl w-96 neon-form transition-transform">
			<h2 class="text-3xl font-bold text-center mb-6">Login</h2>
		<form id="loginForm">
			<div id="errorMessage" class="hidden text-center rb-red-500 text-red-500 p-2 rounded"></div>
			<div class="mb-4">
				<label for="username" class="block text-sm font-medium mb-2">Email or Username</label>
				<input type="text" id="username" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your username">
			</div>
			<div class="mb-6">
				<label for="password" class="block text-sm font-medium mb-2">Password</label>
				<input type="password" id="password" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your password">
			</div>
			<div id="twoFactorSection" class="hidden mb-6">
				<p class="text-sm mb-3 text-purple-100">Enter the 6-digit code from your authenticator app or one of your recovery codes.</p>
				<label for="twoFactorCode" class="block text-sm font-medium mb-2">Authenticator code</label>
				<input type="text" id="twoFactorCode" inputmode="numeric" maxlength="8" class="w-full p-3 mb-4 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="123456">
				<label for="twoFactorRecovery" class="block text-sm font-medium mb-2">Recovery code (optional)</label>
				<input type="text" id="twoFactorRecovery" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="XXXX-XXXX">
			</div>
			<button id="loginButton" type="submit" class="w-full bg-fuchsia-600 hover:bg-pink-400 text-white font-bold py-3 rounded-xl transition">Login</button>
			<div class="relative flex items-center my-6">
				<span class="flex-grow h-px bg-purple-500"></span>
				<span class="px-3 text-sm uppercase tracking-wide text-purple-200">or</span>
				<span class="flex-grow h-px bg-purple-500"></span>
			</div>
			<a id="oauth42Button" href="/api/oauth/42/login" class="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition border border-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400">
				<div class="flex items-center justify-center h-6 w-6">
					<img src="https://upload.wikimedia.org/wikipedia/commons/8/8d/42_Logo.svg" alt="42 logo" class="max-h-full max-w-full" style="filter: brightness(0) invert(1);" loading="lazy">
				</div>
				<span>Continue with 42</span>
			</a>
		</form>
		<p class="text-center mt-6">
			<a href="/accountRecovery" class="text-yellow-300 font-bold hover:text-yellow-100 transition">Lost Your Password ?</a>
		</p>
		<p class="text-center mt-6">
			<a href="/register" class="text-yellow-300 font-bold hover:text-yellow-100 transition">Create Account</a>
		</p>
		</div>
	</div>
		`;
	};

	afterRender(): void {
		const form = document.getElementById("loginForm") as HTMLFormElement | null;
		const loginButton = document.getElementById("loginButton") as HTMLButtonElement | null;
		const usernameInput = document.getElementById("username") as HTMLInputElement | null;
		const passwordInput = document.getElementById("password") as HTMLInputElement | null;
		const twoFactorSection = document.getElementById("twoFactorSection") as HTMLDivElement | null;
		const twoFactorCodeInput = document.getElementById("twoFactorCode") as HTMLInputElement | null;
		const recoveryInput = document.getElementById("twoFactorRecovery") as HTMLInputElement | null;
		const errorDiv = document.getElementById("errorMessage") as HTMLDivElement | null;
		const oauth42Button = document.getElementById("oauth42Button") as HTMLAnchorElement | null;

		let challengeToken: string | null = null;

		oauth42Button?.addEventListener("click", (event) => {
			event.preventDefault();
			window.location.href = "/api/oauth/42/login";
		});

		const showError = (message: string) => {
			if (!errorDiv) return;
			errorDiv.textContent = message;
			errorDiv.classList.remove("hidden");
		};

		const clearError = () => {
			if (!errorDiv) return;
			errorDiv.textContent = "";
			errorDiv.classList.add("hidden");
		};

		const oauthErrorMap: Record<string, string> = {
			invalid_state: "The 42 login attempt expired. Please try again.",
			missing_code: "The 42 provider did not return the authorization code. Please retry.",
			token_exchange_failed: "Fetching the 42 access token failed. Please try again shortly.",
			profile_fetch_failed: "Unable to retrieve your 42 profile. Please try again.",
			internal_error: "Something went wrong during the 42 login. Please try again.",
			already_connected: "This account is already connected on another session."
		};

		const oauthErrorCode = new URLSearchParams(window.location.search).get("oauthError");
		if (oauthErrorCode) {
			showError(oauthErrorMap[oauthErrorCode] ?? "Something went wrong during the 42 login. Please try again.");
		}

		const resetTwoFactorStep = () => {
			challengeToken = null;
			loginButton && (loginButton.textContent = "Login");
			twoFactorSection?.classList.add("hidden");
			twoFactorCodeInput && (twoFactorCodeInput.value = "");
			recoveryInput && (recoveryInput.value = "");
			usernameInput?.removeAttribute("disabled");
			passwordInput?.removeAttribute("disabled");
		};

		const moveToTwoFactorStep = (message?: string) => {
			loginButton && (loginButton.textContent = "Verify 2FA");
			twoFactorSection?.classList.remove("hidden");
			usernameInput?.setAttribute("disabled", "true");
			passwordInput?.setAttribute("disabled", "true");
			twoFactorCodeInput && (twoFactorCodeInput.value = "");
			recoveryInput && (recoveryInput.value = "");
			if (message) {
				showError(message);
			}
			twoFactorCodeInput?.focus();
		};

		const loginSuccess = async () => {
			const g = await GlobalSocket.getInstance();
			g.setupListeners();
			navigate("/");
		};

		form?.addEventListener("submit", async (event) => {
			event.preventDefault();
			clearError();

			if (!usernameInput || !passwordInput || !loginButton) {
				showError("The login form is not ready. Please refresh the page.");
				return;
			}

			try {
				if (challengeToken) {
					const payload = {
						challenge: challengeToken,
						code: twoFactorCodeInput?.value.trim() || undefined,
						recoveryCode: recoveryInput?.value.trim() || undefined
					};
					const response = await fetch("/api/login/2fa", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "include",
						body: JSON.stringify(payload)
					});

					if (response.ok) {
						await loginSuccess();
						return;
					}

					let errorData: any = null;
					try {
						errorData = await response.json();
					} catch { }

					if (errorData?.error === "invalid_2fa_code") {
						showError("Invalid authentication or recovery code.");
					} else if (errorData?.error === "invalid challenge") {
						resetTwoFactorStep();
						showError("Your verification challenge expired. Please sign in again.");
					} else if (errorData?.error) {
						showError(errorData.error);
					} else {
						showError("Verification failed. Please try again.");
					}
					return;
				}

				const firstStepResponse = await fetch("/api/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
				});

				if (firstStepResponse.ok) {
					await loginSuccess();
					return;
				}

				let errorData: any = null;
				try {
					errorData = await firstStepResponse.json();
				} catch { }

				if (errorData?.twoFactorRequired && errorData.challenge) {
					challengeToken = errorData.challenge;
					moveToTwoFactorStep("Two-factor authentication required.");
					return;
				}

				if (errorData?.error) {
					showError(errorData.error);
				} else {
					showError("Login failed. Please try again.");
				}
				resetTwoFactorStep();
			} catch (err) {
				console.error("Request failed", err);
				showError("Unable to reach the server. Please check your connection and try again.");
			}
		});
	};
}
