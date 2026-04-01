import { Component, mountComponent } from "../Component.js";
import { FriendsListAPI } from "./FriendsList/FriendsListAPI.js";
import { FriendsListState } from "./FriendsList/FriendsListState.js";
import { FriendsListUI } from "./FriendsList/FriendsListUI.js";
import { FriendsListUIEmitter } from "./FriendsList/FriendsListUIEmitter.js";
import { FriendsListSocket } from "./FriendsList/friendsListSocket.js";

export class FriendsList extends Component {
	render(): string {
		return `
<div class="text-yellow-300 flex justify-center items-center">
<div class="w-96 p-4 rounded-xl shadow-lg border border-purple-500 neon-bg flex flex-col">

	<div class="flex border-b border-gray-700">
		<button id="friendsTab-btn"
			class="tab-button p-2 w-full text-white border-b-4 border-transparent hover:bg-gray-800 transition-all">
			Friends
		</button>
		<button id="pendingTab-btn"

			class="tab-button p-2 w-full text-white border-b-4 border-transparent hover:bg-gray-800 transition-all">
			Pending
		</button>
		<button id="blockedTab-btn"
			class="tab-button p-2 w-full text-white border-b-4 border-transparent hover:bg-gray-800 transition-all">
			Blocked
		</button>
	</div>

	<div class="flex justify-between items-center mb-4">
		<button id="friendRequests" class="hidden text-sm px-3 py-1 bg-opacity-80 hover:bg-purple-500 rounded-lg">new</button>
	</div>

	<div id="friendsTab" class="tab-content">
		<div class="flex flex-col flex-grow">
			<ul id="friendsList" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"></ul>

			<button id="addFriend" class="text-sm px-3 py-1 cyber-button rounded-lg mt-4 mx-auto">+ Add</button>
		</div>
	</div>

	<div id="pendingTab" class="tab-content hidden">
		<div class="flex flex-col">
			received
			<div class="flex flex-col flex-grow">
				<ul id="receivedRequestsList" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"></ul>
			</div>
			sent
			<div class="flex flex-col flex-grow">
				<ul id="sentRequestsList" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"></ul>
			</div>
		</div>
	</div>

	<div id="blockedTab" class="tab-content hidden">
		<ul id="blockedList" class="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700">
			</ul>
	</div>
</div>

	<div id="friendModal" class="hidden fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center">
		<div id="friendsProfileCardComp" class="neutral"></div>
	</div>

	<div id="addFriendModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-100 backdrop-blur-sm hidden">
	<div class="relative w-96 bg-gray-900 text-white rounded-xl shadow-xl p-6">
		<h2 class="text-xl font-semibold text-purple-400 mb-4">Add a New Friend</h2>

		<div
 id="addFriendMessage" class="hidden text-center text-red-500 p-2 rounded"></div>

		<form id="addFriendForm" autocomplete="off">
			<label for="friendUsername" class="block text-sm font-medium text-gray-300 mb-1">Friend's Username:</label>
			<input type="text" inputemode="text" spellcheck="false" autocomplete="off" id="friendUsername" name="friendUsername" required class="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">

			<div class="mt-4 flex justify-end space-x-2">
				<button type="button" id="closeAddFriendModal" class="px-4
 py-2 text-sm font-semibold text-gray-300 hover:text-white transition">Close</button>
				<button type="submit" class="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition rounded-lg">Add Friend</button>
			</div>
		</form>
	</div>
	</div>
</div>

		`;
	}

	async afterRender(): Promise<void> {
		const friendsListState = await FriendsListState.getInstance();
		const friendsListUi = new FriendsListUI();
		// const friendsListSocket = new FriendsListSocket();
		const friendsListSocket = await FriendsListSocket.getInstance();
		const friendsListUiemitter = FriendsListUIEmitter.getInstance();

		friendsListUi.setTab('friendsTab');

		friendsListUi.renderFriends(friendsListState);
		friendsListUi.renderSentRequests(friendsListState);
		friendsListUi.renderReceivedRequests(friendsListState);
		friendsListUi.renderBlockedList(friendsListState); // Ajouté

		friendsListState.on("friendRemoved", (id) => FriendsListAPI.deleteFriend(id));

		friendsListState.on("stateChanged", () => {
			friendsListUi.renderFriends(friendsListState);
			friendsListUi.renderSentRequests(friendsListState);
			friendsListUi.renderReceivedRequests(friendsListState);
			friendsListUi.renderBlockedList(friendsListState);
		});

		friendsListState.on("requestStateChanged", () => friendsListUi.renderReceivedRequests(friendsListState));
		friendsListState.on("friendRequestEmpty", () => friendsListUi.renderReceivedRequests(friendsListState));
		friendsListState.on("friendRequestEmpty", () => friendsListUi.setTab('friendsTab'));
		friendsListState.on("newSentRequest", () => friendsListUi.renderSentRequests(friendsListState));
		friendsListState.on("friendAccepted", () => friendsListUi.renderSentRequests(friendsListState));
		friendsListState.on("sentRequestRemoved", () => friendsListUi.renderSentRequests(friendsListState));
		friendsListState.on("friendInviteCanceled", () => friendsListUi.renderSentRequests(friendsListState));

		friendsListUiemitter.addEventListener("profileCardClosed", () => friendsListUi.closeProfileCard());

		friendsListUi.setupListeners(friendsListState);
		friendsListSocket.destroylisteners();
		friendsListSocket.setupListeners(friendsListState);
	}
}
