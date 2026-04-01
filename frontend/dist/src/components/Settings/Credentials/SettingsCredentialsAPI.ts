export class SettingsCredentialsAPI {
	static async changeUsername(newUsername: string): Promise<void | Error> {
		const response = await fetch('/api/users/username', {
			method: "PATCH",
			credentials: 'include',
			body: JSON.stringify(newUsername)
		})
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async changeEmail(newEmail: string): Promise<void | Error> {
		const response = await fetch('/api/users/email', {
			method: "PATCH",
			credentials: 'include',
			body: JSON.stringify(newEmail)
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void | Error> {
		const response = await fetch("/api/users/password", {
			method: 'PATCH',
			credentials: 'include',
			body: JSON.stringify({currentPassword, newPassword, confirmPassword})
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}
}
