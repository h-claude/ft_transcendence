import { publicUserToFriend } from "../../types/conversions.js";
import { Friend } from "../../types/friends.js";

export class FriendsListAPI {
	private constructor(){}

	static async getFriendsList(): Promise<Friend[] | Error>  {
		const response = await fetch ("/api/friends/list", {
			method: 'GET',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
		});
		if (!response.ok) {
			return (new Error("couldnt retrieve friends :("));
		}
		const a = await response.json();
		return (a.message);
	}

	static async deleteFriend(idToDelete: number): Promise<void | Error> {
		const data = JSON.stringify(idToDelete);
		const response = await fetch("/api/friends" , {
			method: 'DELETE',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data
		});
		if (!response.ok) {
			return (new Error("cannot delete friend for some reason"));
		}
		const responseData = await response.json();
	}

	static async sendFriendRequest(idToBefriend: string): Promise<string> {
		const data = JSON.stringify(idToBefriend);
		const response =  await fetch("/api/friends/request", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		const responseData = await response.json();
		if (response.ok) {
			return (responseData.message);
		} else {
			return (responseData.error);
		}
	}

	static async getReceivedFriendRequests(): Promise<Friend[]> {
		const response = await fetch ("/api/friends/requests/received", {
			method: 'GET',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
		})
		const responseData = await response.json();
		return responseData.message;
	}

	static async getSentFriendRequests(): Promise<Friend[]> {
		const response = await fetch ("/api/friends/requests/sent", {
			method: 'GET',
			credentials: "include"
		})
		const responseData = await response.json();
		return responseData.message;
	}

	static async acceptFriendRequest(friendId: string): Promise<void | Error> {
		const data = JSON.stringify(friendId);
		const response =  await fetch("/api/friends/accept", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async declineFriendRequest(friendId: string): Promise<void | Error> {
		const data = JSON.stringify(friendId);
		const response =  await fetch("/api/friends/decline", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async cancelFriendRequest(friendId: string): Promise<void | Error> {
		const data = JSON.stringify(friendId);
		const response = await fetch("/api/friends/requests/cancel", {
			method: 'DELETE',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		const responseData = await response.json();
		if (!response.ok) {
			return (new Error(responseData.error));
		}
	}

	static async getFriendById(friendId: string): Promise<Friend> {
		const response = await fetch(`/api/friends/id/${friendId}`, {
			method: 'GET',
			headers: {"Content-Type": 'application/json'},
			credentials: "include"
		});
		const responseData = await response.json();
		return responseData.message;
	}

	static async getUserAsFriendByUsername(username: string): Promise<Friend> {
		const r = await fetch(`/api/users/public/username/${username}`, {
			method: 'GET',
			credentials: "include"
		});
		const responseData = await r.json();
		return (publicUserToFriend(responseData.message));
	}

	static async blockUser(userId: number): Promise<void | Error> {
		const data = JSON.stringify(userId);
		const response = await fetch("/api/friends/block", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		if (!response.ok) {
			const r = await response.json();
			return (new Error(r.error));
		}
	}

	static async unblockUser(userId: number): Promise<void | Error> {
		const data = JSON.stringify(userId);
		const response = await fetch("/api/friends/unblock", {
			method: 'POST',
			headers: {"Content-Type": "application/json"},
			credentials: "include",
			body: data,
		});
		if (!response.ok) {
			const r = await response.json();
			return (new Error(r.error));
		}
	}

	static async getBlockedUsers(): Promise<Friend[]> {
		const response = await fetch("/api/friends/blocked/list", {
			method: 'GET',
			credentials: "include"
		});
		if (!response.ok) {
			return [];
		}
		const a = await response.json();
		return (a.message);
	}
}
