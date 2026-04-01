import { FriendsListAPI } from "./FriendsListAPI.js";
import { FriendsListState } from "./FriendsListState.js";
import { Friend, SmallUser } from "../../types/friends.js";
import { mountComponent } from "../../Component.js";
import { ProfileCard } from "../ProfileCard.js";

export class FriendsListUI {
	private friendsList: HTMLElement;
	private friendModal: HTMLElement;
	private modalName: HTMLElement;
	private modalStatus: HTMLElement;
	private closeModal: HTMLElement;
	private removeFriendbutton: HTMLElement;
	private addFriend: HTMLElement;
	private addFriendModal: HTMLElement;
	private addFriendForm: HTMLFormElement;
	private closeAddFriendModalButton: HTMLElement;
	private addFriendMessage: HTMLDivElement;
	private friendRequestsButton: HTMLElement;
	private receivedRequestsList: HTMLElement;
	private sentRequestsList: HTMLElement;
	private profileCardComp: HTMLElement;
	private tab1: HTMLElement;
	private tab2: HTMLElement;
	private tab3: HTMLElement;
	private blockedList: HTMLElement; // Ajouté

	constructor() {
		this.friendsList = document.getElementById("friendsList")!;
		this.friendModal = document.getElementById("friendModal")!;
		this.modalName = document.getElementById("modalName")!;
		this.modalStatus = document.getElementById("modalStatus")!;
		this.closeModal = document.getElementById("closeModal")!;
		this.removeFriendbutton = document.getElementById("removeFriend")!;
		this.addFriend = document.getElementById("addFriend")!;
		this.addFriendModal = document.getElementById("addFriendModal")!;
		this.addFriendForm = <HTMLFormElement>document.getElementById("addFriendForm")!;
		this.closeAddFriendModalButton = document.getElementById("closeAddFriendModal")!;
		this.addFriendMessage = <HTMLDivElement>document.getElementById("addFriendMessage");
		this.friendRequestsButton = document.getElementById("friendRequests")!;
		this.receivedRequestsList = document.getElementById("receivedRequestsList")!;
		this.tab1 = document.getElementById('friendsTab-btn')!;
		this.tab2 = document.getElementById('pendingTab-btn')!;
		this.tab3 = document.getElementById('blockedTab-btn')!;
		this.sentRequestsList = document.getElementById("sentRequestsList")!;
		this.profileCardComp = document.getElementById("friendsProfileCardComp")!;
		this.blockedList = document.getElementById("blockedList")!; // Ajouté
	}

	renderFriends(friendsListState: FriendsListState) {
		this.friendsList.innerHTML = "";
		friendsListState.forEachFriend((f) => {
			const li = document.createElement("li");
			li.className = "flex text-white p-6 justify-between items-center rounder-lg cursor-pointer friend"
			li.innerHTML = `
				<span class="text-sm">${f.username}</span>
				<div class="flex items-center space-x-2">
					<span class="text-xs ${f.status === 'online' ? 'status-dot online' : 'status-dot offline'}">
					</span>
				</div>
			`;
			li.onclick = () => this.openFriendCard(f, friendsListState);
			this.friendsList.appendChild(li);
		});
	}

	renderSentRequests(friendsListState: FriendsListState) {
		this.sentRequestsList.innerHTML = "";
		friendsListState.forEachSent((f) => {
			const li = document.createElement("li");
			li.className = "flex text-white p-6 justify-between items-center rounder-lg cursor-pointer friend"
			li.innerHTML = `
				<span class="text-sm">${f.username}</span>
				<div class="flex items-center space-x-2">
					<span class="text-xs ${f.status === 'online' ? 'status-dot online' : 'status-dot offline'}">
					</span>
				</div>
			`;
			li.onclick = () => this.openFriendCard(f, friendsListState);
			this.sentRequestsList.appendChild(li);
		});
	}

	closeProfileCard() {
		// this.friendModal.innerHTML = "";
		this.profileCardComp.innerHTML = "";
		this.friendModal.classList.add("hidden");
	}

	private openFriendCard(friend: Friend, friendsListState: FriendsListState) {
		mountComponent(ProfileCard, "friendsProfileCardComp", friend.id);
		this.friendModal.classList.remove("hidden");
	}

	renderReceivedRequests(friendsListState: FriendsListState) {
		const pendingNb = friendsListState.getRequestNb();
		this.receivedRequestsList.innerHTML = "";
		if (!pendingNb) {
			this.friendRequestsButton.classList.add("hidden");
			// return ; // Ne pas retourner, pour que les listeners soient attachés
		} else {
			this.friendRequestsButton.classList.remove("hidden");
		}
		
		friendsListState.forEachReceivedRequest((f) => {
			const li = document.createElement("li");
			li.className = "flex justify-between items-center p-2 rounded-lg shadow-md transition hover:bg-gray-800 border";
			li.innerHTML = `
				<span class="text-sm text-purple-300 font-semibold">${f.username}</span>
				<div class="flex items-center space-x-3">
					<button class="acceptFriendRequest px-3 py-1 text-sm font-semibold text-black bg-purple-500 hover:bg-purple-600 transition border border-purple-400 rounded-lg shadow-lg neon-glow" data-id="${f.id}">
						✔ Accept
					</button>
					<button class="declineFriendRequest px-3 py-1 text-sm font-semibold text-black bg-red-500 hover:bg-red-600 transition border border-red-400 rounded-lg shadow-lg neon-glow" data-id="${f.id}">
						✖ Deny
					</button>
				</div>
			`;
			this.receivedRequestsList.appendChild(li);
		});
		// un peu chiant de les mettre dans setupListeners ces deux la
		document.querySelectorAll(".acceptFriendRequest").forEach(button => {
			button.addEventListener("click", async (event) => {
				const friendId = (event.target as HTMLElement).getAttribute("data-id")!;
				const rp = FriendsListAPI.acceptFriendRequest(friendId);
				if (rp instanceof Error) {
					alert(rp.message);
				} else {
					const newFriend = await FriendsListAPI.getFriendById(friendId);
					friendsListState.acceptFriend(newFriend);
					friendsListState.removeRequest(Number.parseInt(friendId));
				}
			});
		});
		document.querySelectorAll(".declineFriendRequest").forEach(button => {
			button.addEventListener("click", async (event) => {
				const friendId = (event.target as HTMLElement).getAttribute("data-id")!;
				const rp = await FriendsListAPI.declineFriendRequest(friendId);
				if (rp instanceof Error) {
					alert(rp.message);
				} else {
					friendsListState.removeRequest(Number.parseInt(friendId));
				}
			});
		});
	}

	// Nouvelle méthode ajoutée
	renderBlockedList(friendsListState: FriendsListState) {
		this.blockedList.innerHTML = "";
		friendsListState.forEachBlocked((f) => {
			const li = document.createElement("li");
			li.className = "flex justify-between items-center p-2 rounded-lg shadow-md transition hover:bg-gray-800 border";
			li.innerHTML = `
				<span class="text-sm text-red-400 font-semibold">${f.username}</span>
				<div class="flex items-center space-x-3">
					<button class="unblockUserButton px-3 py-1 text-sm font-semibold text-black bg-green-500 hover:bg-green-600 transition border border-green-400 rounded-lg shadow-lg" data-id="${f.id}">
						Unblock
					</button>
				</div>
			`;
			this.blockedList.appendChild(li);
		});

		// Ajouter les listeners pour les nouveaux boutons "Unblock"
		document.querySelectorAll(".unblockUserButton").forEach(button => {
			button.addEventListener("click", async (event) => {
				const friendId = (event.target as HTMLElement).getAttribute("data-id")!;
				await friendsListState.unblockUser(Number.parseInt(friendId));
			});
		});
	}

	setTab(tabId: string) {
		document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
		document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('border-purple-500', 'bg-gray-800'));

		document.getElementById(tabId)?.classList.remove('hidden');
		document.getElementById(`${tabId}-btn`)?.classList.add('border-purple-500', 'bg-gray-800');
	}

	setupListeners(friendsListState: FriendsListState) {
		this.addFriendForm.addEventListener("submit", async (event) => {
			event.stopPropagation();
			event.preventDefault();
			const formData = new FormData(this.addFriendForm);
			const newFriendUsername = <string>formData.get('friendUsername')!;
			const ret = await FriendsListAPI.sendFriendRequest(newFriendUsername);
			this.addFriendMessage.textContent = ret;
			if (ret === "Invitation sent") {
				// const u = await FriendsListAPI.getFriendById(newFriendUsername);
				const u = await FriendsListAPI.getUserAsFriendByUsername(newFriendUsername);
				console.log(u);
				friendsListState.addSentRequest(u);
			}
			this.addFriendMessage.textContent = ret;
			this.addFriendMessage.classList.remove("hidden");
		})

		this.addFriend.onclick = async () => {
			this.addFriendModal.classList.remove("hidden");
		}

		this.closeAddFriendModalButton.onclick = () => {
			this.addFriendMessage.classList.add("hidden");
			this.addFriendModal.classList.add("hidden");
		}

		this.tab1.onclick = () => {
			this.setTab('friendsTab');
		}

		this.tab2.onclick = () => {
			this.setTab('pendingTab');
		}

		this.tab3.onclick = () => {
			this.setTab('blockedTab');
		}
	}
}