import { Component } from "../Component.js"
import { navigate } from "../navigation.js"
import { PublicUser, User } from "../types/user.js"
import { UserStore } from "../store.js"
import { WebSocketManager } from "../WebSocketManager.js"
import { Friend } from "../types/friends.js"
import { FriendsListState } from "./FriendsList/FriendsListState.js"
import { FriendsListUIEmitter } from "./FriendsList/FriendsListUIEmitter.js"
import { ProfileCardAPI } from "./ProfileCard/ProfileCardAPI.js"
import { ChatAPI } from "./Chat/ChatAPI.js"
import { ChatUIEmitter } from "./Chat/ChatUIEmitter.js"
import { FriendsListAPI } from "./FriendsList/FriendsListAPI.js"
import { FriendsList } from "./FriendsList.js"
import { Message } from "../types/chat.js"
import { ChatState } from "./Chat/ChatState.js"

/**
 * After render needs the ID of the user which card is displayed.
 */
export class ProfileCard extends Component {
	render(): string {
		return `
<div id="profileCardMain" class="relative max-w-sm mx-auto p-6 border-2 border-purple-500 shadow-neon rounded-2xl text-white transform transition-all duration-300 neon-border">
<div id="profileCardAvatarWrapper" class="p-4 flex justify-center z-10 relative">
  <img
	id="profileCardAvatarImg"
	class="w-24 h-24 rounded-full object-cover border-4 border-purple-500 shadow-lg"
  />
</div>

<img id="profileCardMainImg" class="img-as-background"/>
	<div class="relative flex items-center justify-between mb-4">
		<h2 id="profCardUsername" class="text-2xl font-extrabold tracking-wider neon-text"></h2>
		<span id="profCardOnlineStatus" class="px-3 py-1 text-sm font-semibold rounded-full glow-animation"></span>
	</div>

	<p id="profCardFriendStatus" class="text-sm text-purple-400 tracking-wide"><span class="font-semibold text-white">Connected</span></p>

	<div class="mt-4 p-2 bg-black bg-opacity-50 rounded-lg shadow-md shadow-purple-500">
		<p class="text-sm">🏆 <span class="font-semibold text-white">Win Rate:</span>
		<span id="profCardWinRate">85%</span>
		</p>
		<p class="text-sm">🎮 <span class="font-semibold text-white">Total games: </span><span id="profCardTotalGames"></span></p>
	</div>


	<div id="profCardButtons" class="flex flex-row"></div>
	<div class="flex justify-center">
		<button id="profCardCloseButton" class="w-1/3 mt-4 py-2 bg-purple-600 text-white font-fold hover:bg-purple-500 rounded-md transform hover:scale-105 transition-all duration-200">
			Close
		</button>
	</div>
</div>`;
	}

	async afterRender(...args: any[]) {
		const friendsListState = await FriendsListState.getInstance();
		const chatState = await ChatState.getInstance();
		const id: number = args[0][0][0];
		const u: PublicUser = await ProfileCardAPI.getUserById(id);
		const onlineStatus = document.getElementById("profCardOnlineStatus")!;
		const username = document.getElementById("profCardUsername")!;
		const friendStatus = document.getElementById("profCardFriendStatus")!;
		const winRateElem = document.getElementById("profCardWinRate")!;
		const totalGames = document.getElementById("profCardTotalGames")!;
		const buttonsAnchor = document.getElementById("profCardButtons")!;
		const main = document.getElementById("profileCardMain")!;
		const mainImg = document.getElementById("profileCardMainImg")! as HTMLImageElement;
		const pp = document.getElementById("profileCardAvatarImg")! as HTMLImageElement;
		const messageForm = document.getElementById("profCardMessageForm")! as HTMLElement;

		const isFriend: boolean = friendsListState.isFriend(id);
		const isInSentFriendRequests: boolean = friendsListState.isInSentRequests(id);
		const isInReceivedFriendRequests: boolean = friendsListState.isInReceivedRequests(id);
		const isBlocked: boolean = friendsListState.isBlocked(id);

		if (isBlocked) {
			messageForm.style.display = "none";
		}

		if (!u.userImageInfos.hasProfileCardPicture || !u.userImageInfos.profileCardPicture) {
			main.classList.add("neon-bg")
			mainImg.src = "";
		} else {
			mainImg.src = u.userImageInfos.profileCardPicture;
			// main.style.backgroundImage = `url(${u.userImageInfos.profileCardPicture})`
		}

		if (!u.userImageInfos.hasProfilePicture || !u.userImageInfos.profilePicture) {
			fetch('/api/images/defaultPp', {
				method: "GET",
				credentials: "include"
			}).then(response => response.blob())
				.then(blob => {
					const url = URL.createObjectURL(blob);
					// const lol = document.getElementById("menuDropdownProfilePic")! as HTMLImageElement; // Cette ligne semble être une erreur de copier/coller
					pp.src = url;
				})
		} else {
			pp.src = u.userImageInfos.profilePicture;
		}

		username.innerHTML = u.username;
		if (u.status === 'online') {
			onlineStatus.innerHTML = '🟢 Online';
			onlineStatus.classList.remove("status-indicator-offline");
			onlineStatus.classList.add("status-indicator-online");
		} else {
			onlineStatus.innerHTML = '🔴 Offline';
			onlineStatus.classList.remove("status-indicator-online");
			onlineStatus.classList.add("status-indicator-offline");
		}
		totalGames.innerHTML = `${(u.wins + u.losses).toFixed(0)}`
		const winRate = (u.wins + u.losses) > 0 ? ((u.wins / (u.wins + u.losses)) * 100) : 0; // Correction pour éviter NaN
		winRateElem.innerHTML = `${winRate.toFixed(1)} %`;

		const addFriendButton = document.createElement("button");
		addFriendButton.classList = "w-1/2 mt-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transform hover:scale-105 transition-all duration-200 glitch-button";
		addFriendButton.id = "profCardAddFriendButton";
		addFriendButton.innerHTML = "➕ Add Friend";

		const blockUserButton = document.createElement("button");
		blockUserButton.classList = "w-1/2 mt-4 py-2 bg-red-600 hover:bg-pink-500 text-white font-bold rounded-md transform hover:scale-105 transition-all duration-200 glitch-button";
		blockUserButton.id = "profCardBlockUserButton";
		blockUserButton.innerHTML = "Block User";

		const removeFriendButton = document.createElement("button");
		removeFriendButton.classList = "w-1/2 mt-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-md transform hover:scale-105 transition-all duration-200 glitch-button";
		removeFriendButton.id = "profCardRemoveFriendButton";
		removeFriendButton.innerHTML = "Remove Friend";

		const cancelFriendInviteButton = document.createElement("button");
		cancelFriendInviteButton.classList = "w-1/2 mt-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-md transform hover:scale-105 transition-all duration-200 glitch-button";
		cancelFriendInviteButton.id = "profCardRemoveFriendButton";
		cancelFriendInviteButton.innerHTML = "Cancel Invitation";

		if (isBlocked) {
			const unblockUserButton = document.createElement("button");
			unblockUserButton.classList = "w-1/2 mt-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-md transform hover:scale-105 transition-all duration-200 glitch-button";
			unblockUserButton.id = "profCardUnblockUserButton";
			unblockUserButton.innerHTML = "Unblock";
			unblockUserButton.onclick = () => {
				friendsListState.unblockUser(id);
				FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
				ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			};
			buttonsAnchor.appendChild(unblockUserButton);
		} else {
			if (isFriend) {
				buttonsAnchor.appendChild(removeFriendButton);
			} else if (!isInReceivedFriendRequests && !isInSentFriendRequests) {
				buttonsAnchor.appendChild(addFriendButton);
			} else if (isInSentFriendRequests) {
				buttonsAnchor.appendChild(cancelFriendInviteButton);
			}
			buttonsAnchor.appendChild(blockUserButton);
		}

		const closeButton = document.getElementById("profCardCloseButton")!;
		closeButton.onclick = () => {
			FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
		}

		blockUserButton.onclick = () => {
			friendsListState.blockUser(u);
			FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
		};

		// seulement si ami
		removeFriendButton.onclick = () => {
			friendsListState.removeFriend(id);
			FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
		};

		// seulement si pas ami et pas blocked
		addFriendButton.onclick = () => {
			FriendsListAPI.sendFriendRequest(u.username);
			friendsListState.addSentRequest(u);
			FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
		};

		cancelFriendInviteButton.onclick = () => {
			friendsListState.cancelRequest(id);
			FriendsListAPI.cancelFriendRequest(u.id.toString());
			FriendsListUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
			ChatUIEmitter.getInstance().dispatchSimpleEvent("profileCardClosed");
		};

		// mettre aussi un accept invitation
	}
}