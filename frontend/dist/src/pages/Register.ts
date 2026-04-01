import { Component } from "../Component.js"
import { navigate } from "../navigation.js";

export class Register extends Component {
	render(): string {
		return `
			<div class="min-h-screen flex items-center justify-center bg-cover bg-center" style="background-image: url('https://images2.alphacoders.com/109/1092728.jpg');">
			  <div class="bg-purple-900 bg-opacity-40 text-white p-8 rounded-2xl shadow-2xl w-96 neon-form transition-transform">
				<h2 class="text-3xl font-bold text-center mb-6">Register</h2>
				<form>
					<div id="errorMessage" class ="hidden text-center rb-red-500 text-red-500 p-2 rounded">
					</div>
				  <div class="mb-4">
					<label for="username" class="block text-sm font-medium mb-2">Username</label>
					<input type="username" id="username" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your Username">
				  </div>
				  <div class="mb-4">
					<label for="email" class="block text-sm font-medium mb-2">Email</label>
					<input type="email" id="email" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your email">
				  </div>
				  <div class="mb-6">
					<label for="password" class="block text-sm font-medium mb-2">Password</label>
					<input type="password" id="password" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your password">
				  </div>
				  <button id="registerButton" type="submit" class="w-full bg-fuchsia-600 hover:bg-pink-400 text-white font-bold py-3 rounded-xl transition">Register</button>
				</form>
				<p class="text-center mt-6 text-yellow-300 font-bold hover:text-yellow-100">
					<a href="/login">Already Have An Account ?</a>
				</p>
			  </div>
			</div>
		`;
	}

	afterRender(): void {
		document.getElementById("registerButton")?.addEventListener('click', async function (event) {
			event.preventDefault();
			const name = (<HTMLInputElement>document.getElementById("username")).value;
			const email = (<HTMLInputElement>document.getElementById("email")).value;
			const password = (<HTMLInputElement>document.getElementById("password")).value;

			const data = { name, email, password };
			try {
				const response = await fetch("/api/users", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify(data)
				})
				if (response.ok) {
					const result = await response.json();
					navigate("/");
				} else {
					const errorData = await response.json();
					const errorDiv = document.getElementById("errorMessage") as HTMLDivElement;
					errorDiv.textContent = errorData.error;
					errorDiv.classList.remove("hidden");
					return;
				}
			} catch (err) {
				console.error("Request failed :'(", err);
			}
		});
	}
}
