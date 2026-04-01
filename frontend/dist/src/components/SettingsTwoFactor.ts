import { Component } from "../Component.js";
import { UserStore } from "../store.js";
import { User } from "../types/user.js";

type SetupResponse = {
	success: boolean;
	secret?: string;
	otpauthUrl?: string;
	qrDataUrl?: string | null;
	error?: string;
};

type ActivateResponse = {
	success: boolean;
	enabled?: boolean;
	recoveryCodes?: string[];
	error?: string;
};

type ManageResponse = {
	success: boolean;
	recoveryCodes?: string[];
	enabled?: boolean;
	message?: string;
	error?: string;
};

type RecoveryContext = "activate" | "regenerate";

export class SettingsTwoFactor extends Component {
	render(): string {
		return (`
  <div class="w-full max-w-3xl mb-16">
    <h2 class="font-orbitron text-2xl md:text-3xl font-bold text-emerald-300 mb-8 text-glow-cyan tracking-wide text-center md:text-left">
      Two-Factor Authentication (2FA)
    </h2>
    <div class="bg-black/30 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
      <p id="twofaStatusText" class="text-sm text-purple-200/80"></p>
      <p id="twofaInfoText" class="text-sm text-emerald-300 hidden"></p>

      <div id="twofaEnableSection" class="space-y-4">
        <p class="text-sm text-purple-100/70">
          Secure your account by requiring a one-time code from an authenticator app in addition to your password.
        </p>
        <button id="twofaStartBtn" class="button-glow bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 py-2.5 px-6 rounded-lg text-sm font-semibold uppercase tracking-wider text-white transition-all duration-300 ease-in-out">
          Enable 2FA
        </button>
      </div>

      <div id="twofaSetupSection" class="hidden space-y-4 border border-purple-500/20 rounded-xl p-4 md:p-6 bg-black/40">
        <h3 class="text-lg font-semibold text-fuchsia-300">Finish the setup</h3>
        <p class="text-sm text-purple-100/70">
          Scan the QR code with Google Authenticator (or any TOTP app) or add the secret manually, then enter the 6-digit code below.
        </p>

        <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div id="twofaQrWrapper" class="rounded-xl bg-white/90 p-3 shadow-lg hidden">
            <img id="twofaQrImage" src="" alt="2FA QR Code" class="h-40 w-40 object-contain"/>
          </div>
          <div class="w-full">
            <p class="text-xs uppercase text-purple-300 mb-1">Secret key</p>
            <code id="twofaSecret" class="block text-sm text-purple-100 bg-black/60 border border-purple-500/30 rounded-lg px-3 py-2 break-words"></code>
          </div>
        </div>

        <div class="space-y-2">
          <label for="twofaCodeInput" class="text-xs uppercase font-semibold text-purple-200 tracking-wider">
            Authenticator code
          </label>
          <input id="twofaCodeInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500" placeholder="123456">
        </div>

        <div class="flex flex-col md:flex-row gap-3">
          <button id="twofaConfirmBtn" class="button-glow bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-2.5 px-5 rounded-lg text-sm font-semibold uppercase tracking-wider text-white transition-all duration-300 ease-in-out">
            Confirm & Activate
          </button>
          <button id="twofaCancelBtn" class="py-2.5 px-5 rounded-lg border border-purple-500/40 text-sm font-semibold uppercase tracking-wider text-purple-200 hover:bg-purple-900/40 transition-all duration-200 ease-in-out">
            Cancel
          </button>
        </div>
      </div>

      <div id="twofaSuccessSection" class="hidden space-y-4 border border-emerald-500/30 rounded-xl p-4 md:p-6 bg-emerald-900/20">
        <h3 id="twofaSuccessTitle" class="text-lg font-semibold text-emerald-300">2FA is now active</h3>
        <p id="twofaSuccessDescription" class="text-sm text-emerald-100/80">
          Store these recovery codes in a safe place. Each code can be used once if you lose access to your authenticator app.
        </p>
        <ul id="twofaRecoveryCodes" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white font-mono"></ul>
      </div>

      <div id="twofaEnabledActions" class="hidden space-y-6">
        <div class="border border-purple-500/20 rounded-xl p-4 md:p-6 bg-black/40 space-y-3">
          <h3 class="text-lg font-semibold text-fuchsia-300">Disable 2FA</h3>
          <p class="text-sm text-purple-100/70">
            Enter a current authenticator code or one of your recovery codes to disable two-factor authentication.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input id="twofaDisableCodeInput" type="text" inputmode="numeric" maxlength="8" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500" placeholder="Authenticator code">
            <input id="twofaDisableRecoveryInput" type="text" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500 uppercase" placeholder="Recovery code (XXXX-XXXX)">
          </div>
          <button id="twofaDisableBtn" class="button-glow bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 py-2.5 px-5 rounded-lg text-sm font-semibold uppercase tracking-wider text-white transition-all duration-300 ease-in-out">
            Disable 2FA
          </button>
        </div>

        <div class="border border-purple-500/20 rounded-xl p-4 md:p-6 bg-black/40 space-y-3">
          <h3 class="text-lg font-semibold text-emerald-300">Regenerate recovery codes</h3>
          <p class="text-sm text-purple-100/70">
            Generate a fresh set of recovery codes. You must provide an authenticator code or a remaining recovery code.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input id="twofaRegenCodeInput" type="text" inputmode="numeric" maxlength="8" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500" placeholder="Authenticator code">
            <input id="twofaRegenRecoveryInput" type="text" class="input-synth w-full px-4 py-2.5 rounded-lg text-sm placeholder-gray-500 uppercase" placeholder="Recovery code (XXXX-XXXX)">
          </div>
          <button id="twofaRegenBtn" class="button-glow bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 py-2.5 px-5 rounded-lg text-sm font-semibold uppercase tracking-wider text-white transition-all duration-300 ease-in-out">
            Regenerate Codes
          </button>
        </div>
      </div>

      <p id="twofaErrorText" class="text-sm text-red-400 hidden"></p>
    </div>
  </div>
		`);
	}

	async afterRender(): Promise<void> {
		const userStore = UserStore.getInstance();
		const user = userStore.getUser();

		const statusText = document.getElementById("twofaStatusText") as HTMLParagraphElement | null;
		const infoText = document.getElementById("twofaInfoText") as HTMLParagraphElement | null;
		const enableSection = document.getElementById("twofaEnableSection") as HTMLDivElement | null;
		const enabledActions = document.getElementById("twofaEnabledActions") as HTMLDivElement | null;
		const startBtn = document.getElementById("twofaStartBtn") as HTMLButtonElement | null;
		const setupSection = document.getElementById("twofaSetupSection") as HTMLDivElement | null;
		const confirmBtn = document.getElementById("twofaConfirmBtn") as HTMLButtonElement | null;
		const cancelBtn = document.getElementById("twofaCancelBtn") as HTMLButtonElement | null;
		const codeInput = document.getElementById("twofaCodeInput") as HTMLInputElement | null;
		const secretText = document.getElementById("twofaSecret") as HTMLElement | null;
		const qrWrapper = document.getElementById("twofaQrWrapper") as HTMLDivElement | null;
		const qrImage = document.getElementById("twofaQrImage") as HTMLImageElement | null;
		const successSection = document.getElementById("twofaSuccessSection") as HTMLDivElement | null;
		const successTitle = document.getElementById("twofaSuccessTitle") as HTMLHeadingElement | null;
		const successDescription = document.getElementById("twofaSuccessDescription") as HTMLParagraphElement | null;
		const recoveryList = document.getElementById("twofaRecoveryCodes") as HTMLUListElement | null;
		const errorText = document.getElementById("twofaErrorText") as HTMLParagraphElement | null;

		const disableBtn = document.getElementById("twofaDisableBtn") as HTMLButtonElement | null;
		const disableCodeInput = document.getElementById("twofaDisableCodeInput") as HTMLInputElement | null;
		const disableRecoveryInput = document.getElementById("twofaDisableRecoveryInput") as HTMLInputElement | null;

		const regenBtn = document.getElementById("twofaRegenBtn") as HTMLButtonElement | null;
		const regenCodeInput = document.getElementById("twofaRegenCodeInput") as HTMLInputElement | null;
		const regenRecoveryInput = document.getElementById("twofaRegenRecoveryInput") as HTMLInputElement | null;

		const renderStatus = (currentUser: User | null) => {
			const enabled = !!currentUser?.twoFactorEnabled;
			const remainingText =
				enabled && typeof currentUser?.twoFactorRecoveryCodesRemaining === "number"
					? ` (${currentUser.twoFactorRecoveryCodesRemaining} recovery codes remaining)`
					: "";

			if (statusText) {
				statusText.textContent = `Status: ${enabled ? "Enabled" : "Disabled"}${remainingText}`;
				statusText.classList.toggle("text-emerald-300", enabled);
				statusText.classList.toggle("text-purple-200/80", !enabled);
			}

			if (enableSection) {
				enableSection.classList.toggle("hidden", enabled);
			}
			if (enabledActions) {
				enabledActions.classList.toggle("hidden", !enabled);
			}
		};

		const setError = (message: string | null) => {
			if (!errorText) return;
			if (message) {
				errorText.textContent = message;
				errorText.classList.remove("hidden");
			} else {
				errorText.textContent = "";
				errorText.classList.add("hidden");
			}
		};

		const setInfo = (message: string | null) => {
			if (!infoText) return;
			if (message) {
				infoText.textContent = message;
				infoText.classList.remove("hidden");
			} else {
				infoText.textContent = "";
				infoText.classList.add("hidden");
			}
		};

		const resetSetup = () => {
			setError(null);
			if (codeInput) codeInput.value = "";
			if (secretText) secretText.textContent = "";
			if (qrWrapper) {
				qrWrapper.classList.add("hidden");
				if (qrImage) qrImage.src = "";
			}
			if (setupSection) setupSection.classList.add("hidden");
			if (successSection) successSection.classList.add("hidden");
			if (recoveryList) recoveryList.innerHTML = "";
		};

		const showRecoveryCodes = (codes: string[] | undefined, context: RecoveryContext) => {
			if (!recoveryList || !successSection) return;
			if (!codes || codes.length === 0) {
				successSection.classList.add("hidden");
				recoveryList.innerHTML = "";
				return;
			}

			recoveryList.innerHTML = "";
			for (const item of codes) {
				const li = document.createElement("li");
				li.textContent = item;
				li.className = "px-3 py-2 rounded-lg bg-black/40 border border-emerald-500/30";
				recoveryList.appendChild(li);
			}

			if (successTitle) {
				successTitle.textContent =
					context === "activate" ? "2FA is now active" : "Recovery codes updated";
			}
			if (successDescription) {
				successDescription.textContent =
					"Store these recovery codes in a safe place. Each code can be used once if you lose access to your authenticator app.";
			}

			successSection.classList.remove("hidden");
		};

		const handleSetup = async () => {
			if (!startBtn) return;
			setError(null);
			setInfo(null);
			startBtn.disabled = true;
			const originalLabel = startBtn.textContent;
			startBtn.textContent = "Generating…";

			try {
				const response = await fetch("/api/2fa/setup", {
					method: "POST",
					credentials: "include"
				});
				const data = await response.json() as SetupResponse;

				if (!response.ok || !data?.success) {
					throw new Error(data?.error || "Unable to start two-factor setup");
				}

				if (secretText) {
					secretText.textContent = data.secret ?? "Unavailable";
				}
				if (qrWrapper && qrImage && data.qrDataUrl) {
					qrImage.src = data.qrDataUrl;
					qrWrapper.classList.remove("hidden");
				} else if (qrWrapper) {
					qrWrapper.classList.add("hidden");
				}

				if (setupSection) setupSection.classList.remove("hidden");
				successSection?.classList.add("hidden");
				codeInput?.focus();
			} catch (error) {
				setError(error instanceof Error ? error.message : "Unexpected error");
			} finally {
				startBtn.disabled = false;
				startBtn.textContent = originalLabel ?? "Enable 2FA";
			}
		};

		const handleActivation = async () => {
			if (!codeInput) return;
			const code = codeInput.value.trim();
			if (!code) {
				setError("Please enter the code generated by your authenticator app.");
				return;
			}

			setError(null);
			setInfo(null);
			if (confirmBtn) {
				confirmBtn.disabled = true;
				confirmBtn.textContent = "Verifying…";
			}

			try {
				const response = await fetch("/api/2fa/activate", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ code })
				});

				const data = await response.json() as ActivateResponse;
				if (!response.ok || !data?.success) {
					throw new Error(data?.error || "Verification failed");
				}

				const recoveryCodes = data.recoveryCodes ?? [];
				setInfo("Two-factor authentication enabled. Keep your recovery codes safe.");

				await userStore.resetUser();
				renderStatus(userStore.getUser());
				resetSetup();
				showRecoveryCodes(recoveryCodes, "activate");
			} catch (error) {
				setError(error instanceof Error ? error.message : "Unexpected error");
			} finally {
				if (confirmBtn) {
					confirmBtn.disabled = false;
					confirmBtn.textContent = "Confirm & Activate";
				}
			}
		};

		const handleDisable = async () => {
			if (!disableBtn) return;
			const code = disableCodeInput?.value.trim() ?? "";
			const recoveryCode = disableRecoveryInput?.value.trim() ?? "";

			if (!code && !recoveryCode) {
				setError("Provide an authenticator code or a recovery code to disable 2FA.");
				return;
			}

			setError(null);
			setInfo(null);
			disableBtn.disabled = true;
			const originalLabel = disableBtn.textContent;
			disableBtn.textContent = "Disabling…";

			try {
				const response = await fetch("/api/2fa/disable", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						code: code || undefined,
						recoveryCode: recoveryCode || undefined
					})
				});
				const data = await response.json() as ManageResponse;
				if (!response.ok || !data?.success) {
					throw new Error(data?.error || "Unable to disable two-factor authentication");
				}

				setInfo("Two-factor authentication has been disabled.");
				disableCodeInput && (disableCodeInput.value = "");
				disableRecoveryInput && (disableRecoveryInput.value = "");
				resetSetup();

				await userStore.resetUser();
				renderStatus(userStore.getUser());
			} catch (error) {
				setError(error instanceof Error ? error.message : "Unexpected error");
			} finally {
				disableBtn.disabled = false;
				disableBtn.textContent = originalLabel ?? "Disable 2FA";
			}
		};

		const handleRegenerate = async () => {
			if (!regenBtn) return;
			const code = regenCodeInput?.value.trim() ?? "";
			const recoveryCode = regenRecoveryInput?.value.trim() ?? "";

			if (!code && !recoveryCode) {
				setError("Provide an authenticator code or a recovery code to regenerate.");
				return;
			}

			setError(null);
			setInfo(null);
			regenBtn.disabled = true;
			const originalLabel = regenBtn.textContent;
			regenBtn.textContent = "Generating…";

			try {
				const response = await fetch("/api/2fa/regenerate-recovery", {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						code: code || undefined,
						recoveryCode: recoveryCode || undefined
					})
				});
				const data = await response.json() as ManageResponse;
				if (!response.ok || !data?.success) {
					throw new Error(data?.error || "Unable to regenerate recovery codes");
				}

				showRecoveryCodes(data.recoveryCodes ?? [], "regenerate");

				setInfo("New recovery codes generated. They will not be shown again.");
				regenCodeInput && (regenCodeInput.value = "");
				regenRecoveryInput && (regenRecoveryInput.value = "");

				await userStore.resetUser();
				renderStatus(userStore.getUser());
			} catch (error) {
				setError(error instanceof Error ? error.message : "Unexpected error");
			} finally {
				regenBtn.disabled = false;
				regenBtn.textContent = originalLabel ?? "Regenerate Codes";
			}
		};

		renderStatus(user);

		startBtn?.addEventListener("click", handleSetup);
		confirmBtn?.addEventListener("click", (event) => {
			event.preventDefault();
			void handleActivation();
		});
		cancelBtn?.addEventListener("click", (event) => {
			event.preventDefault();
			resetSetup();
			setInfo(null);
		});
		disableBtn?.addEventListener("click", (event) => {
			event.preventDefault();
			void handleDisable();
		});
		regenBtn?.addEventListener("click", (event) => {
			event.preventDefault();
			void handleRegenerate();
		});
	}
}
