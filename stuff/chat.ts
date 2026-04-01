document.addEventListener("DOMContentLoaded", () => {
    const chatMessages = document.getElementById("chat-messages")!;
    const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement;
    const sendButton = document.getElementById("send-btn")!;

    interface ChatMessage {
        text: string;
        timestamp: string;
        sender: "me" | "other";
    }

    const messages: ChatMessage[] = [];

    function renderMessages() {
        chatMessages.innerHTML = "";
        messages.forEach(msg => {
            const msgElement = document.createElement("div");
			// rajouter whitespace-pre-line pour prendre en compte les
			// whitespace dans l'affichage. Malheureusement ca rajoute aussi
			// des \n avant et apres.
			// https://stackoverflow.com/questions/53394575/white-space-pre-line-adds-unusal-space-at-top
            msgElement.className = `p-2 max-w-[80%] rounded-lg text-sm break-words relative ${
                msg.sender === "me"
                    ? "bg-purple-700 text-white self-end"
                    : "bg-neutral-800 text-yellow-200 self-start"
            }`;

            msgElement.innerHTML = `
                <span>${msg.text}</span>
                <div class="text-xs text-right opacity-70 mt-1">${msg.timestamp}</div>
            `;
            chatMessages.appendChild(msgElement);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

	messages.push({
		text: "lol",
		timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		sender: "other",
	})
    function sendMessage() {
        const text = chatInput.value.trim();
        if (text === "") return;

        messages.push({
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            sender: "me"
        });

        chatInput.value = "";
        chatInput.style.height = "auto"; // Reset textarea height
        renderMessages();
    }

    sendButton.addEventListener("click", sendMessage);

    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    chatInput.addEventListener("input", () => {
        chatInput.style.height = "auto";
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 160)}px`; // Auto-expand up to 160px
    });

    chatMessages.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("invite-btn")) {
            alert("Game invite sent!");
        }
    });

    renderMessages();
});

