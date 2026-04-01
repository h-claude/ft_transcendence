import { Conversation, userStatusChange } from "./chat.js";
import { Friend } from "./friends.js";

export interface User {
	id: number;
	username: string;
	email: string;
	wins: number;
	losses: number;
	highestKdr: number;
	userImageInfos: UserImageInfos;
	twoFactorEnabled?: boolean;
	twoFactorRecoveryCodesRemaining?: number | null;
};

/**
 * Represents the publicly availble informations
 * for a user. Should only contains non-sensitive
 * informations to be displayed to other
 * users.
*/
export interface PublicUser {
	id: number;
	username: string;
	status: "online" | "offline";
	lastSeen: string;
	wins: number;
	losses: number;
	highestKdr: number;
	userImageInfos: UserImageInfos;
}

export interface UserImageInfos {
	hasProfilePicture: boolean;
	hasProfileBackgroundPicture: boolean;
	hasProfileCardPicture: boolean;
	profilePicture: string | null; //base 64
	profileBackgroundPicture: string | null; //base 64
	profileCardPicture: string | null; //base 64
}
