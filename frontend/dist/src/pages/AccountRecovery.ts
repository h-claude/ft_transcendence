import { Component } from "../Component.js"

export class AccountRecovery extends Component {
	render(): string {
		return `
			<div class="min-h-screen flex items-center justify-center bg-cover bg-center" style="background-image: url('https://images2.alphacoders.com/109/1092728.jpg');">
			  <div class="bg-purple-900 bg-opacity-40 text-white p-8 rounded-2xl shadow-2xl w-96 neon-form transition-transform">
				<h2 class="text-3xl font-bold text-center mb-6">Recover Your Account</h2>
				<form>
				  <div class="mb-4">
					<label for="username" class="block text-sm font-medium mb-2">Username or Email</label>
					<input type="username" id="username" class="w-full p-3 rounded-xl bg-purple-800 text-white focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Username or Email">
				  </div>
				  <button type="submit" class="w-full bg-fuchsia-600 hover:bg-pink-400 text-white font-bold py-3 rounded-xl transition">Recover Account</button>
				</form>
				<p class="text-center mt-6 text-yellow-300">
					<a href="/login" class="text-yellow-300 font-bold hover:text-yellow-100 transition">Back to Login</a>
				</p>
			  </div>
			</div>
		`;
	}
}
