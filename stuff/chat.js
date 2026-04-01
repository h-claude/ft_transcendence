document.addEventListener("DOMContentLoaded", function () {
    var chatMessages = document.getElementById("chat-messages");
    var chatInput = document.getElementById("chat-input");
    var sendButton = document.getElementById("send-btn");
    var messages = [];
    function renderMessages() {
        chatMessages.innerHTML = "";
        messages.forEach(function (msg) {
            var msgElement = document.createElement("div");
            // rajouter whitespace-pre-line pour prendre en compte les
            // whitespace dans l'affichage. Malheureusement ca rajoute aussi
            // des \n avant et apres.
            // https://stackoverflow.com/questions/53394575/white-space-pre-line-adds-unusal-space-at-top
            msgElement.className = "p-2 max-w-[80%] rounded-lg text-sm break-words relative ".concat(msg.sender === "me"
                ? "bg-purple-700 text-white self-end"
                : "bg-neutral-800 text-yellow-200 self-start");
            msgElement.innerHTML = "\n                <span>".concat(msg.text, "</span>\n                <div class=\"text-xs text-right opacity-70 mt-1\">").concat(msg.timestamp, "</div>\n            ");
            chatMessages.appendChild(msgElement);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    messages.push({
        text: "lol",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sender: "other",
    });
    function sendMessage() {
        var text = chatInput.value.trim();
        if (text === "")
            return;
        messages.push({
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            sender: "me"
        });
        chatInput.value = "";
        chatInput.style.height = "auto"; // Reset textarea height
        renderMessages();
    }
    sendButton.addEventListener("click", sendMessage);
    chatInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    chatInput.addEventListener("input", function () {
        chatInput.style.height = "auto";
        chatInput.style.height = "".concat(Math.min(chatInput.scrollHeight, 160), "px"); // Auto-expand up to 160px
    });
    chatMessages.addEventListener("click", function (e) {
        if (e.target.classList.contains("invite-btn")) {
            alert("Game invite sent!");
        }
    });
    renderMessages();
});
