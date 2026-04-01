export interface Friend {
	id: number;
	username: string;
	status: "online" | "offline";
	lastSeen?: string;
}

export interface SmallUser {
	username: string,
	id: number
}
