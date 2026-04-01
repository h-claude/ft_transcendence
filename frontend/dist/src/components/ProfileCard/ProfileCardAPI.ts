import { PublicUser } from "../../types/user.js";

export class ProfileCardAPI {
	private constructor(){}

	static async getUserById(userId: number): Promise<PublicUser> {
		const f = await fetch(`/api/users/public/id/${userId}`, {
			method: "GET",
			credentials: "include"
		});
		const r = await f.json();
		r.message.userImageInfos = JSON.parse(r.message.UserImageInfos);

		if (r.message.userImageInfos.hasProfilePicture) {
			await fetch(`/api/images/user/${r.message.id}/pp`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
			 .then(blob => {
					const url = URL.createObjectURL(blob);
					r.message.userImageInfos.profilePicture = url;
			});
		}

		if (r.message.userImageInfos.hasProfileBackgroundPicture) {
			await fetch(`/api/images/user/${r.message.id}/bg`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
			 .then(blob => {
					const url =  URL.createObjectURL(blob);
					r.message.userImageInfos.profileBackgroundPicture = url;
			});
		}

		if (r.message.userImageInfos.hasProfileCardPicture) {
			await fetch(`/api/images/user/${r.message.id}/card`, {
				method: 'GET',
				credentials: 'include'
			}).then(response => response.blob())
			  .then(blob => {
					const url = URL.createObjectURL(blob);
					r.message.userImageInfos.profileCardPicture = url;
			   });
		}

		return (r.message);
	}
}
