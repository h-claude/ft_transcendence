import { PublicUser } from "./user";
import { Friend } from "./friends";

export function publicUserToFriend(pu: PublicUser): Friend {
	return {
		id: pu.id,
		username: pu.username,
		status: pu.status
	};
}
