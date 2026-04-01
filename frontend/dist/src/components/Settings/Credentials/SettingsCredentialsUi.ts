import { UserStore } from "../../../store.js";
import { User } from "../../../types/user.js";
import { SettingsCredentialsAPI } from "./SettingsCredentialsAPI.js";

export class SettingsCredentialsUi {
	private usernameInput: HTMLInputElement;
	private emailInput: HTMLInputElement;
	private saveChangesButton: HTMLElement;
	private currentPasswordInput: HTMLInputElement;
	private newPasswordInput: HTMLInputElement;
	private confirmPasswordInput: HTMLInputElement;
	private errorDiv: HTMLElement;
	private usernameValid: HTMLElement;
	private emailValid: HTMLElement;
	private passwordValid: HTMLElement;

	constructor() {
		this.usernameInput = <HTMLInputElement>document.getElementById("usernameInputCredentials")!;
		this.emailInput = <HTMLInputElement>document.getElementById("emailInputCredentials")!;
		this.saveChangesButton = document.getElementById("settingsSaveChangesButton")!;
		this.currentPasswordInput = <HTMLInputElement>document.getElementById("currentPasswordInputCredentials")!;
		this.newPasswordInput = <HTMLInputElement>document.getElementById("newPasswordInputCredentials")!
		this.confirmPasswordInput = <HTMLInputElement>document.getElementById("confimPasswordInputCredentials")!;
		this.errorDiv = document.getElementById("errorDivInputCredentials")!;
		this.usernameValid = document.getElementById("usernameValidInputCredentials")!;
		this.emailValid = document.getElementById("emailValidInputCredentials")!;
		this.passwordValid = document.getElementById("passwordValidInputCredentials")!;
	}

	fillInputsWithDefault(user: User) {
		this.usernameInput.value = user.username;
		this.emailInput.value = user.email;
	}

	private isSamePassword() {
		return (this.newPasswordInput.value.trim() === this.confirmPasswordInput.value.trim())
	}

	private async error(message: string) {
		this.errorDiv.classList.remove("hidden");
		this.errorDiv.innerHTML = message;
		setTimeout(() => {
			this.errorDiv.classList.add("hidden");
		}, 3000);
		this.errorDiv.innerHTML = "";
	}

	private async triggerMessage(div: HTMLElement, message: string, color: string) {
		div.classList.remove("hidden");
		div.classList.forEach(cls => {
			if (cls.startsWith("text-")) {
				div.classList.remove(cls);
			}
		})
		div.classList.add(`text-${color}`);
		div.innerHTML = message;
		setTimeout(() => {
			div.classList.add("hidden");
		}, 3000);
		div.classList.add("text-xs");
	}

	setupListener(user: User | null) {
		// TODO: changer la couleur des divs pas bonnes en cas d'erreur + tremblement
		this.saveChangesButton.addEventListener("click", async (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (!user) return ;
			// change username
			if (this.usernameInput.value.trim() !== user.username) {
				const v = await SettingsCredentialsAPI.changeUsername(this.usernameInput.value.trim());
				if (v instanceof Error) {
					console.log(v.message);
					await this.triggerMessage(this.usernameValid, v.message, "red-400");
					return ;
				}
				UserStore.getInstance().dispatchEvent(new Event("change"));
				await UserStore.getInstance().resetUser();
				user = UserStore.getInstance().getUser();
				if (!user) {
					return ;
				}
				await this.triggerMessage(this.usernameValid, "Username Changed", "green-400");
			}

			// change email
			if (this.emailInput.value.trim() !== user.email) {
				const v = await SettingsCredentialsAPI.changeEmail(this.emailInput.value.trim());
				if (v instanceof Error) {
					console.log(v.message);
					await this.triggerMessage(this.emailValid, v.message, "red-400");
					return ;
				}
				await UserStore.getInstance().resetUser();
				user = UserStore.getInstance().getUser();
				if (!user) return ;
				await this.triggerMessage(this.emailValid, "Email Changed", "green-400");
			}

			// change password
			if (this.currentPasswordInput.value.trim().length &&
				this.newPasswordInput.value.trim().length &&
				this.confirmPasswordInput.value.trim().length) {
				if (!this.isSamePassword()) {
					await this.triggerMessage(this.passwordValid, "password not the same good luck next time", "red-400");
				} else {
					const r = await SettingsCredentialsAPI.changePassword(this.currentPasswordInput.value.trim(),
					this.newPasswordInput.value.trim(),
					this.confirmPasswordInput.value.trim());
					if (r instanceof Error) {
						await this.triggerMessage(this.passwordValid, r.message, "red-400");
						return ;
					}
					await this.triggerMessage(this.passwordValid, "Password Changed", "green-400");
				}
			}
		});
	}
}
