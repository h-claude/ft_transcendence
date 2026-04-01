export interface Message {
	content: string;
	conversationId: number;
	id: number;
	receiverId: number;
	senderId: number;
	timestamp: string;
	type: "system" | "user"
}

export interface Conversation {
	correspondentId: number;
	correspondentUsername: string;
	messages: Message[];
}

export interface ConvOneOnOne {
	conversationId: number;
	createdAt: string;
	messages: Message[];
	name: string;
	type: "public" | "private";
	/**contains the id of the correspondent if private conv,
	 * or null if public, not null actually just dont use it
	 * if public*/
	correspondentId: number;
}

export interface userStatusChange {
	fromId: number;
	newStatus: "offline" | "online";
}
