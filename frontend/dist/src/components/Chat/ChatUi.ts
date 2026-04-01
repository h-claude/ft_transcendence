import { mountComponent } from "../../Component.js";
import { UserStore } from "../../store.js";
import { Conversation, ConvOneOnOne, Message, userStatusChange } from "../../types/chat.js";
import { PublicUser } from "../../types/user.js";
import { FriendsListAPI } from "../FriendsList/FriendsListAPI.js";
import { FriendsListState } from "../FriendsList/FriendsListState.js";
import { GameAPI } from "../Game/GameAPI.js";
import { ProfileCard } from "../ProfileCard.js";
import { ProfileCardAPI } from "../ProfileCard/ProfileCardAPI.js";
import { ChatAPI } from "./ChatAPI.js";
import { ChatInput } from "./ChatInput.js";
import { ChatState } from "./ChatState.js";
import { ChatSystemMessageProcessor } from "./ChatSystemMessageProcessor.js";

export class ChatUi {
	private chatMessages: HTMLElement;
	private userList: HTMLElement;
	private convListErrorMsg: HTMLElement;
	private currentChatId: number;
	private currentConvId: number;
	private chatInput: HTMLTextAreaElement;
	private addConvButton: HTMLElement;
	private newConvInput: HTMLInputElement;
	private sendButton: HTMLElement;
	private profileCardButton: HTMLElement;
	private profileCardComp: HTMLElement;
	private friendModal: HTMLElement;
	private inviteButton: HTMLElement;
	private errorMessageInside: HTMLElement;
	private invitePopup: HTMLElement;

	constructor() {
		this.chatMessages = document.getElementById("chat-messages")!;
		this.userList = document.getElementById("user-list")!;
		this.currentChatId = -1;
		this.currentConvId = -1;
		this.convListErrorMsg = document.getElementById("conv-error-message")!;
		this.addConvButton = document.getElementById("add-conv-button")!;;
		this.newConvInput =  <HTMLInputElement>document.getElementById("new-user-input")!;
		this.chatInput = <HTMLTextAreaElement>document.getElementById("chat-input")!;
		this.sendButton = document.getElementById("send-btn")!;
		this.profileCardButton = document.getElementById("chatProfileButton")!;
		this.profileCardComp = document.getElementById("chatProfileCardComp")!;
		this.friendModal = document.getElementById("chatFriendModal")!;
		this.inviteButton = document.getElementById("chatSendGameInviteButton")!;
		this.errorMessageInside = document.getElementById("chatErrorMessageInside")!;
		this.invitePopup = document.getElementById("invitePopup")!;
	}

	async renderConvList(chatState: ChatState) {
		if (this.userList) {
			this.userList.innerHTML = "";
		}
		chatState.forEachConv(async (conv) => {
			const newConv = await this.createNewConv(conv);
			newConv.onclick = () => {
				var curConvs = Array.from(document.getElementsByClassName(".conv"));
				curConvs.forEach((e) => {
					e.classList.remove("bg-purple-700");
					e.classList.add("bg-purple-700");
				});
				this.currentChatId = Number.parseInt(newConv.getAttribute("data-id")!, 10);
				this.currentConvId = Number.parseInt(newConv.getAttribute("data-convid")!, 10);
				newConv.classList.remove("bg-purple-700");
				newConv.classList.add("bg-green-700");
				this.renderMessages(chatState);
			}
		});
	}

	async createNewConv(conv: ConvOneOnOne) {
		const friendsListState = await FriendsListState.getInstance();
		const isFriend: boolean = friendsListState.isFriend(conv.correspondentId);
		const u: PublicUser = await ProfileCardAPI.getUserById(conv.correspondentId);
		const status: "online" | "offline" = u.status;
		var statusDot: string;

		if (isFriend && status === 'online') {
			statusDot = "status-dot online";
		} else if (isFriend && status === 'offline') {
			statusDot = "status-dot offline";
		} else {
			statusDot = "";
		}

		const convElement = document.createElement("div");
		convElement.className = ".conv p-2 friend text-white rounded-md cursor-pointer transition overflow-x-auto whitespace-nowrap w-full";
		convElement.setAttribute("data-id", `${conv.correspondentId}`);
		convElement.setAttribute("data-convid", `${conv.conversationId}`);
		convElement.innerHTML = `
					<span class="text-sm">${u.username}</span>
					<div class = flex "items-center space-x-2">
						<span class="text-xs ${statusDot}">
						</span>
					</div>`;
		this.userList.appendChild(convElement);
		return (convElement);
	}

	renderMessages(chatState: ChatState) {
		if (!chatState.hasConv(this.currentConvId)) {
			return;
		}
		this.chatMessages.innerHTML = "";

		chatState.forEachMessage(this.currentConvId, (msg) => {
			if (msg.senderId === 1 && msg.receiverId != UserStore.getInstance().getUser()?.id) {
				return;
			}

			var	msgElement;
			if (msg.type === "system") {
				msgElement = ChatSystemMessageProcessor.process(msg);
				if (!msgElement) {
					return ;
				}
			} else {
				msgElement = document.createElement("div");
				var		placement;
				if (msg.senderId === UserStore.getInstance().getUser()?.id) {
					placement = "bg-purple-700 text-white self-end";
				} else if (msg.senderId != 1) {
					placement = "bg-neutral-800 text-yellow-200 self-start";
				} else {
					placement = "bg-neutral-800 text-red-200 self-center";
				}
				msgElement.className = `p-2 max-w-[50%] rounded-lg text-sm break-all relative ${placement}`;
				msgElement.innerHTML = `
					<span>${msg.content}</span>
					<div class="text-xs text-right opacity-70 mt-1">${msg.timestamp}</div>
				`;
			}
			this.chatMessages.appendChild(msgElement);
		});
		this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
	}

	setupListeners(chatState: ChatState, chatInput: ChatInput) {
		this.addConvButton.addEventListener("click", async () => {
			const username = this.newConvInput.value.trim();
			if (!username) {
				this.convError("username empty");
				return ;
			}
			const r = await ChatAPI.createNewConversation(username);
			if (r instanceof Error) {
				this.convError(r.message);
				return ;
			}
			const uid = UserStore.getInstance().getUser()?.id;
			if (!uid) return ;

			chatState.addConversation(r.convId, {
				conversationId: r.convId,
				createdAt: "0",
				messages: [{
					senderId: 1,
					receiverId: uid,
					content: "This is the start of your conversation. Send a message to say hi !",
					conversationId: r.convId,
					id: -1,
					timestamp: "0",
					type: "user" // TODO: passer sur system peut etre ?
				}],
				name: "a",
				type: 'private',
				correspondentId: r.userId,
			});
			this.newConvInput.value = "";
		});

		this.newConvInput.addEventListener("keydown", async (event) => {
			if (event.key === "Enter") {
				const username = this.newConvInput.value.trim();
				if (!username) {
					this.convError("username empty");
					return ;
				}
				const r = await ChatAPI.createNewConversation(username);
				if (r instanceof Error) {
					this.convError(r.message);
					return ;
				}
				const uid = UserStore.getInstance().getUser()?.id;
				if (!uid) return ;

				chatState.addConversation(r.convId, {
					conversationId: r.convId,
					createdAt: "0",
					messages: [{
						senderId: 1,
						receiverId: uid,
						content: "This is the start of your conversation. Send a message to say hi !",
						conversationId: r.convId,
						id: -1,
						timestamp: "0",
						type: "user"
					}],
					name: "a",
					type: 'private',
					correspondentId: r.userId,
				});
				this.newConvInput.value = "";
			}
		});

		this.profileCardButton.onclick = () => {
			if (this.currentChatId == -1) {
				return ;
			}
			mountComponent(ProfileCard, "chatProfileCardComp", this.currentChatId);
			this.friendModal.classList.remove("hidden");
		}

		this.inviteButton.onclick = async () => {
			if (this.currentChatId == -1) {
				return ;
			}
			const ret = await GameAPI.sendDirectInvite(this.currentChatId);
			if (ret instanceof Error) {
				this.errorMessageInside.innerHTML = ret.message;
				this.errorMessageInside.classList.remove("hidden");
				setTimeout(() => {
					this.errorMessageInside.classList.add("hidden");
				}, 3000);
			} else {
				const user = UserStore.getInstance().getUser();
				if (!user) {
					return ;
				}
				chatState.addServerMessage(this.currentConvId, {
					content: "game_direct_invite_sent",
					conversationId: this.currentConvId,
					id: -1,
					receiverId: user.id,
					senderId: 1,
					timestamp: "0",
					type: "system"
				});
				const gameInfos = await ChatAPI.hasActivePendingDirectGame();
				if (gameInfos !== "not in a match") {
					this.openInvitePopup();
					await this.renderInvitePopup(gameInfos);
				}
			}
		}

		this.sendButton.addEventListener("click", async () => await chatInput.sendMessage(chatState, this));

		this.chatInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				chatInput.sendMessage(chatState, this);
			}
		});

		this.chatInput.addEventListener("input", () => {
			this.autoExpandInputForm();
		})
	}

	async updateStatusDotByUserId(userId: number) {
		const d: HTMLElement | null = this.getConvListDivByUserId(userId);
		if (!d) {
			console.log("renderConvListDivByUserId: eror");
			return ;
		}

		const chatState = await ChatState.getInstance();
		const conv = chatState.getConv(Number.parseInt(d.getAttribute("data-convid")!));
		if (!conv) {
			return ;
		}
		const friendsListState = await FriendsListState.getInstance();
		const isFriend: boolean = friendsListState.isFriend(conv.correspondentId);
		const u: PublicUser = await ProfileCardAPI.getUserById(conv.correspondentId);
		const status: "online" | "offline" = u.status;
		const c1 = d.children[1];
		const c2 = c1.children[0];
		c2.classList.remove("status-dot");
		c2.classList.remove("online");
		c2.classList.remove("offline");

		if (isFriend && status === 'online') {
			c2.classList.add("status-dot");
			c2.classList.add("online");
		} else if (isFriend && status === 'offline') {
			c2.classList.add("status-dot");
			c2.classList.add("offline");
		}
	}

	getConvListDivById(convId: number): HTMLElement | null {
		const elements = document.getElementsByClassName(".conv");
		var d: HTMLElement | null = null;
		Array.prototype.forEach.call(elements, (e) => {
			if (Number.parseInt(e.dataset.convid!, 10) === convId) {
				d = e;
			}
		});
		return (d);
	}

	getConvListDivByUserId(userId: number): HTMLElement | null {
		const elements = document.getElementsByClassName(".conv");
		var d: HTMLElement | null = null;
		Array.prototype.forEach.call(elements, (e) => {
			if (Number.parseInt(e.dataset.id!, 10) === userId) {
				d = e;
			}
		});
		return (d);
	}

	getConvIdByUserId(userId: number): number | undefined {
		const elements = document.getElementsByClassName(".conv");
		var id: number | undefined = undefined;
		Array.prototype.forEach.call(elements, (e) => {
			if (Number.parseInt(e.dataset.id!, 10) === userId) {
				id = Number.parseInt(e.dataset.convid!, 10);
			}
		});
		return (id)
	}

	newMessageChatNotif(convId: number) {
		const div = this.getConvListDivById(convId);
		if (!div) {
			return ;
		}
		div.classList.add("convNotifNewMessage");
		setTimeout(() => {
			div.classList.remove("convNotifNewMessage");
		}, 2000);
	}

	changeStatus(detail: userStatusChange) {
		const conv = this.getConvListDivByUserId(detail.fromId);
		if (!conv) {
			console.log("not in a conversation with this friend");
			return ;
		}
		// si le status dot est casse c'est tres certainement qu'on
		// a change le structure du DOM a cet endroit.
		var statusDot = conv.children[1];
		statusDot = statusDot.children[0];
		statusDot.classList.remove("offline");
		statusDot.classList.remove("online");
		statusDot.classList.add(detail.newStatus);
	}

	// TODO un type pour gameInfos. pour l'instant:
	// matchId: number
	// matchStatus: "pending | ongoing | finished | canceled"
	// matchType: "direct | mm | tournament"
	// initiator: boolean
	// opponentId: number
	async renderInvitePopup(gameInfos: any) {
		if (gameInfos.matchType !== "direct") {
			console.log("wrong type of game for the invite popup : " + gameInfos.matchType);
			return ;
		} else if (gameInfos.matchStatus !== "pending") {
			console.log("wrong match status for invite popup");
			return ;
		}

		this.invitePopup.innerHTML = "";
		this.invitePopup.innerText = "";
		const u = UserStore.getInstance().getUser();
		if (!u) {
			return ;
		}
		const otherUser: PublicUser = await ProfileCardAPI.getUserById(gameInfos.opponentId);
		if (gameInfos.initiator) {
			const infoDiv = document.createElement("div");
			infoDiv.className = "text-white font-semibold text-center mb-4";
			infoDiv.innerText = `Game invite sent`;
			this.invitePopup.appendChild(infoDiv);

			const cancelButton = document.createElement("button");
			cancelButton.className = `
				px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500
				text-white transition duration-200 ease-in-out shadow-md
			`;
			cancelButton.innerText = "Cancel Invitation";
			this.invitePopup.appendChild(cancelButton);

			cancelButton.onclick = async () => {
				await ChatAPI.cancelDirectGameInvite();
			};
		} else {
			const infoDiv = document.createElement("div");
			infoDiv.className = "text-white font-semibold text-center mb-4";
			infoDiv.innerText = `Game invite from ${otherUser.username}`;
			this.invitePopup.appendChild(infoDiv);

			const buttonsDiv = document.createElement("div");
			buttonsDiv.className = "flex gap-3 justify-center";
			this.invitePopup.appendChild(buttonsDiv);

			const acceptButton = document.createElement("button");
			acceptButton.className = `
				px-4 py-2 text-sm rounded-md bg-green-600 hover:bg-green-500
				text-white transition duration-200 ease-in-out shadow-md
			`;
			acceptButton.innerText = "Accept Invitation";

			const declineButton = document.createElement("button");
			declineButton.className = `
				px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500
				text-white transition duration-200 ease-in-out shadow-md
			`;
			declineButton.innerText = "Decline Invitation";

			buttonsDiv.appendChild(acceptButton);
			buttonsDiv.appendChild(declineButton);

			declineButton.onclick = async () => {
				await ChatAPI.declineDirectGameInvite();
			}
			acceptButton.onclick = async () => {
				this.invitePopup.innerHTML = "";
				await ChatAPI.acceptDirectGameInvite();
			}
		}

	}

	openInvitePopup() {
		this.invitePopup.classList.remove("hidden");
	}

	closeInvitePopup() {
		this.invitePopup.classList.add("hidden");
	}

	closeProfileCard() {
		this.profileCardComp.innerHTML = "";
		this.friendModal.classList.add("hidden");
	}

	async convError(message: string) {
		this.convListErrorMsg.classList.remove("hidden");
		this.convListErrorMsg.innerHTML = message;
		setTimeout(() => {
			this.convListErrorMsg.classList.add("hidden");
			this.convListErrorMsg.innerHTML = "";
		}, 4000);
	}

	async wizz(fromId: number) {
		const div = this.getConvListDivByUserId(fromId);
		if (!div) {
			return ;
		}
		div.classList.add("animate-spin");
		setTimeout(() => div.classList.remove("animate-spin"), 2000);
	}

	autoExpandInputForm() {
		this.chatInput.style.height = "auto";
		this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 160)}px`;
	}

	getCurrentConvId() {
		return (this.currentConvId);
	}

	getCurrentCid() {
		return (this.currentChatId);
	}
}
