import { Component, mountComponent } from "../Component.js";
import { ChatAPI } from "./Chat/ChatAPI.js";
import { WebSocketManager } from "../WebSocketManager.js";
import { ChatSocket } from "./Chat/ChatSocket.js";
import { ChatInput } from "./Chat/ChatInput.js";
import { ChatUIEmitter } from "./Chat/ChatUIEmitter.js";
import { ProfileCard } from "./ProfileCard.js";
import { ChatState } from "./Chat/ChatState.js";
import { ChatUi } from "./Chat/ChatUi.js";
import { userStatusChange } from "../types/chat.js";
import { FriendsListUIEmitter } from "./FriendsList/FriendsListUIEmitter.js";
import { FriendsListState } from "./FriendsList/FriendsListState.js";

export class Chat extends Component {

	render(): string {
		return `
<div class="flex items-center justify-center">

    <!-- Chat Wrapper -->
    <div class="flex h-[500px] w-[600px] md:w-[700px] bg-neutral-900 border border-purple-600 rounded-lg shadow-lg">

        <!-- Left Sidebar: User List -->
        <div class="w-1/3 bg-neutral-800 border-r border-purple-600 p-3 flex flex-col">
            <h2 class="text-white text-lg font-semibold mb-2">Chats</h2>

			<div id="conv-error-message" class="hidden text-red-500"></div>
			<div class="flex items-center gap-2 mb-3">
				<input id="new-user-input" type="text"
					class="flex-1 min-w-0 p-2 text-white bg-neutral-700 border border-purple-500 rounded-md focus:outline-none focus:border-purple-400 transition"
					placeholder="Enter username..." />
				<button id="add-conv-button"
					class="p-2 bg-purple-500 hover:bg-yellow-300 text-white rounded-md transition flex-shrink-0">
					+
				</button>
			</div>

            <div id="user-list" class="space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-neutral-700">
                <!-- User items will be added dynamically -->
            </div>
        </div>

        <!-- Chat Container -->
        <div class="flex flex-col flex-1">
			<!-- Chat Header -->
			<div class="flex flex-col items-center p-3 text-black font-semibold text-lg bg-purple-800 space-y-1">
				<div class="flex gap-2">
					<button id="chatProfileButton" class="bg-yellow-400 hover:bg-yellow-300 rounded-xl px-3 py-1">view profile</button>
					<button id="chatSendGameInviteButton" class="bg-yellow-400 hover:bg-yellow-300 rounded-xl px-3 py-1">invite</button>
				</div>
				<div id="chatErrorMessageInside" class="text-red-600 hidden">lol</div>
			</div>


			<!-- Invite Popup -->
			<div id="invitePopup"
				class="h-1/4 bg-gradient-to-br from-pink-500 via-purple-300 to-indigo-600 text-white flex flex-col items-center justify-center text-xl hidden">
			</div>

            <!-- Messages Container -->
            <div id="chat-messages" class="flex flex-col gap-2 p-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-neutral-700">
                <!-- Messages will be injected here -->
            </div>

            <!-- Message Input -->
            <div class="p-3 border-t border-purple-600 flex items-center gap-2">
                <textarea id="chat-input"
                    class="w-full p-2 text-white bg-neutral-800 border border-neutral-700 rounded-md focus:outline-none focus:border-purple-500 resize-none max-h-40 overflow-auto"
                    placeholder="Type a message..."></textarea>
                <button id="send-btn"
                    class="p-2 px-3 bg-purple-500 hover:bg-purple-700 text-white rounded-md transition">
                    Send
                </button>
            </div>
        </div>
    </div>
</div>

    <div id="chatFriendModal" class="hidden fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center">
		<div id="chatProfileCardComp" class="neutral"></div>
    </div>
`;
	}

	async afterRender(): Promise<void> {
		// const chatSocket = new ChatSocket();
		// await chatSocket.init();
		const chatSocket = await ChatSocket.getInstance();
		const chatInput = new ChatInput();
		const chatUiEmitter = ChatUIEmitter.getInstance();
		const chatState = await ChatState.getInstance();
		const chatUi = new ChatUi();
		const friendsListState = await FriendsListState.getInstance();

		// affichages initiaux
		chatUi.renderConvList(chatState);
		let gameInfos = await ChatAPI.hasActivePendingDirectGame();
		if (gameInfos !== "not in a match") {
			chatUi.openInvitePopup();
			await chatUi.renderInvitePopup(gameInfos);
		}

		// events
		chatState.on("newConversation", () => {
			chatUi.renderConvList(chatState)
		});
		chatState.on("newMessage", () => {
			chatUi.renderMessages(chatState)
		});
		chatUiEmitter.addEventListener("newMessage", (event) => {
			chatUi.newMessageChatNotif((event as CustomEvent<number>).detail)
		});
		chatUiEmitter.addEventListener("wizz", async () => {
			await chatSocket.sendWizz(chatUi.getCurrentCid())
		});
		chatUiEmitter.addEventListener("userStatusChanged", async (event) => {
			chatUi.changeStatus((event as CustomEvent<userStatusChange>).detail)
		});
		chatUiEmitter.addEventListener("profileCardClosed", (e) => {
			chatUi.closeProfileCard();
		});
		chatUiEmitter.addEventListener("gameDirectInviteRequest", async (e) => {
			let gameInfos = await ChatAPI.hasActivePendingDirectGame();
			chatUi.openInvitePopup();
			console.log("Type de game " + gameInfos.type);
			await chatUi.renderInvitePopup(gameInfos);
		})
		chatUiEmitter.addEventListener("gameDirectInviteDeclined", (e) => {
			chatUi.closeInvitePopup();
		})
		chatUiEmitter.addEventListener("gameDirectInviteCanceled", (e) => {
			chatUi.closeInvitePopup();
		})
		chatState.on("newServerMessage", (msg) => {
			chatUi.renderMessages(chatState);
		});
		friendsListState.on("friendAccepted", async (id) => {
			await chatUi.updateStatusDotByUserId(id);
		});
		friendsListState.on("friendAdded", async (id) => {
			await chatUi.updateStatusDotByUserId(id);
		});
		friendsListState.on("friendRemoved", async (id) => {
			await chatUi.updateStatusDotByUserId(id);
		});
		chatSocket.destroyListeners();
		chatUi.setupListeners(chatState, chatInput);
		chatSocket.setupListeners(chatState, chatUi, chatUiEmitter);
	}
}
